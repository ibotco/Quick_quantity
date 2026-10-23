/* =====================================================================
   RATE BUILD-UP / PRICE ANALYSIS
   The list is generated from the drawing: every priced item the
   measurement produces becomes a build-up, grouped by rate, largest
   value first. Rates with a known make-up are built from the market
   prices below; proprietary items (doors, fittings, services) get an
   assessed split of the rate, which the user can overwrite line by line.
   Everything is editable: input prices, quantities per unit, fixed
   allowances, overheads and the rate finally adopted in the bill.
   ===================================================================== */
(function (root) {
  'use strict';

  /* ---- market prices adopted (Greater Accra, Q4 2026) ---- */
  const INPUTS = [
    { id: 'cement32', cat: 'Cement, sand and aggregate', label: 'Cement, CEM II 32.5R, 50 kg bag (Ghacem / CIMAF / Dangote)', unit: 'bag', price: 101 },
    { id: 'cement42', cat: 'Cement, sand and aggregate', label: 'Cement, CEM I 42.5R, 50 kg bag', unit: 'bag', price: 112 },
    { id: 'whiteCement', cat: 'Cement, sand and aggregate', label: 'White cement, 25 kg bag', unit: 'bag', price: 175 },
    { id: 'lime', cat: 'Cement, sand and aggregate', label: 'Hydrated lime, 25 kg bag', unit: 'bag', price: 90 },
    { id: 'sand', cat: 'Cement, sand and aggregate', label: 'Sharp sand, per cubic metre delivered', unit: 'm3', price: 210 },
    { id: 'plasterSand', cat: 'Cement, sand and aggregate', label: 'Plaster sand, sieved, per cubic metre', unit: 'm3', price: 240 },
    { id: 'aggregate', cat: 'Cement, sand and aggregate', label: 'Coarse aggregate (chippings), per cubic metre delivered', unit: 'm3', price: 300 },
    { id: 'laterite', cat: 'Cement, sand and aggregate', label: 'Laterite fill, per cubic metre', unit: 'm3', price: 130 },
    { id: 'hardcoreMat', cat: 'Cement, sand and aggregate', label: 'Hardcore (crushed stone), per cubic metre', unit: 'm3', price: 185 },
    { id: 'beddingMat', cat: 'Cement, sand and aggregate', label: 'Granular bedding / selected fill, per cubic metre', unit: 'm3', price: 240 },
    { id: 'block100', cat: 'Blocks and masonry', label: 'Sandcrete block, 100 mm (4 inch) hollow, delivered', unit: 'No.', price: 7 },
    { id: 'block150', cat: 'Blocks and masonry', label: 'Sandcrete block, 150 mm (6 inch) hollow, delivered', unit: 'No.', price: 8 },
    { id: 'block225', cat: 'Blocks and masonry', label: 'Sandcrete block, 225 mm (9 inch) hollow, delivered', unit: 'No.', price: 11 },
    { id: 'block300', cat: 'Blocks and masonry', label: 'Sandcrete block, 300 mm (12 inch) hollow, delivered', unit: 'No.', price: 15 },
    { id: 'brick', cat: 'Blocks and masonry', label: 'Burnt clay brick, delivered', unit: 'No.', price: 3.5 },
    { id: 'rebar', cat: 'Steel and reinforcement', label: 'High-yield deformed reinforcement bar, per tonne (ex-Accra)', unit: 't', price: 8800 },
    { id: 'mesh', cat: 'Steel and reinforcement', label: 'A142 fabric reinforcement, per square metre', unit: 'm2', price: 57 },
    { id: 'bindingWire', cat: 'Steel and reinforcement', label: 'Binding wire, per kilogram', unit: 'kg', price: 28 },
    { id: 'steelSection', cat: 'Steel and reinforcement', label: 'Structural steel section (UB / UC), per tonne', unit: 't', price: 12500 },
    { id: 'steelPlate', cat: 'Steel and reinforcement', label: 'Steel plate and angle, per tonne', unit: 't', price: 14500 },
    { id: 'purlinSteel', cat: 'Steel and reinforcement', label: 'Galvanised C-purlin, 100 mm, per metre', unit: 'm', price: 42 },
    { id: 'weldingRod', cat: 'Steel and reinforcement', label: 'Welding electrodes, per kilogram', unit: 'kg', price: 45 },
    { id: 'hardwood', cat: 'Timber and boards', label: 'Sawn hardwood, per cubic metre', unit: 'm3', price: 2400 },
    { id: 'softwood', cat: 'Timber and boards', label: 'Sawn softwood (structural), per cubic metre', unit: 'm3', price: 1850 },
    { id: 'plywood', cat: 'Timber and boards', label: 'Plywood, 18 mm, 1.22 x 2.44 m sheet', unit: 'sheet', price: 420 },
    { id: 'formPly', cat: 'Timber and boards', label: 'Formwork plywood, 18 mm, per sheet', unit: 'sheet', price: 480 },
    { id: 'roofSheet', cat: 'Roofing', label: 'Aluminium long-span roofing sheet, 0.50 mm, laid', unit: 'm2', price: 168 },
    { id: 'roofSheetIBR', cat: 'Roofing', label: 'Aluzinc IBR sheet, 0.55 mm, laid', unit: 'm2', price: 95 },
    { id: 'roofTile', cat: 'Roofing', label: 'Stone-coated / concrete roof tile, laid', unit: 'm2', price: 195 },
    { id: 'insulation', cat: 'Roofing', label: 'Roof insulation (foil-backed), per square metre', unit: 'm2', price: 65 },
    { id: 'ridgeCap', cat: 'Roofing', label: 'Ridge cap, per metre', unit: 'm', price: 42 },
    { id: 'gutter', cat: 'Roofing', label: 'PVC gutter, 150 mm, per metre', unit: 'm', price: 85 },
    { id: 'downpipe', cat: 'Roofing', label: 'PVC downpipe, 110 mm, per metre', unit: 'm', price: 65 },
    { id: 'fixings', cat: 'Roofing', label: 'Roofing screws, washers and sealant, per box', unit: 'box', price: 45 },
    { id: 'polythene', cat: 'Waterproofing and ground treatment', label: 'Polythene damp-proof membrane, 500 gauge, per m2', unit: 'm2', price: 9 },
    { id: 'membrane', cat: 'Waterproofing and ground treatment', label: 'Torch-on waterproofing membrane, per m2', unit: 'm2', price: 95 },
    { id: 'primerWP', cat: 'Waterproofing and ground treatment', label: 'Bituminous primer, per litre', unit: 'l', price: 80 },
    { id: 'termiticide', cat: 'Waterproofing and ground treatment', label: 'Termiticide concentrate, per litre', unit: 'l', price: 48 },
    { id: 'pvcBoard', cat: 'Ceilings', label: 'PVC ceiling board, 200 mm, per square metre', unit: 'm2', price: 95 },
    { id: 'ceilingBoard', cat: 'Ceilings', label: 'Plasterboard, 9.5 mm, per square metre', unit: 'm2', price: 72 },
    { id: 'popPowder', cat: 'Ceilings', label: 'POP / plaster of Paris, 25 kg bag', unit: 'bag', price: 110 },
    { id: 'gridMain', cat: 'Ceilings', label: 'Suspended ceiling main runner, 3.6 m', unit: 'No.', price: 38 },
    { id: 'gridCross', cat: 'Ceilings', label: 'Suspended ceiling cross tee, 1.2 m', unit: 'No.', price: 18 },
    { id: 'mineralTile', cat: 'Ceilings', label: 'Mineral fibre ceiling tile, 600 x 600 mm', unit: 'No.', price: 45 },
    { id: 'fibreBoard', cat: 'Ceilings', label: 'Fibre cement ceiling board, 6 mm, per m2', unit: 'm2', price: 105 },
    { id: 'timberBoard', cat: 'Ceilings', label: 'Timber ceiling boards, per square metre', unit: 'm2', price: 165 },
    { id: 'corniceMat', cat: 'Ceilings', label: 'Cornice / coving, per metre', unit: 'm', price: 18 },
    { id: 'hatchSet', cat: 'Ceilings', label: 'Roof access hatch and frame, complete', unit: 'No.', price: 330 },
    { id: 'terrazzoChip', cat: 'Floor and wall finishes', label: 'Granite chippings for terrazzo, per cubic metre', unit: 'm3', price: 900 },
    { id: 'tiles', cat: 'Floor and wall finishes', label: 'Ceramic floor tiles 300 x 300 mm, per m2', unit: 'm2', price: 120 },
    { id: 'wallTiles', cat: 'Floor and wall finishes', label: 'Ceramic wall tiles, per m2', unit: 'm2', price: 145 },
    { id: 'porcelain', cat: 'Floor and wall finishes', label: 'Porcelain tile, 600 x 600 mm, per m2', unit: 'm2', price: 185 },
    { id: 'granite', cat: 'Floor and wall finishes', label: 'Granite tile / slab, per m2', unit: 'm2', price: 360 },
    { id: 'marble', cat: 'Floor and wall finishes', label: 'Marble tile, per m2', unit: 'm2', price: 520 },
    { id: 'woodFloor', cat: 'Floor and wall finishes', label: 'Timber strip flooring, per m2', unit: 'm2', price: 215 },
    { id: 'laminate', cat: 'Floor and wall finishes', label: 'Laminate flooring, per m2', unit: 'm2', price: 210 },
    { id: 'vinyl', cat: 'Floor and wall finishes', label: 'Vinyl sheet flooring, per m2', unit: 'm2', price: 160 },
    { id: 'carpet', cat: 'Floor and wall finishes', label: 'Carpet tile, per m2', unit: 'm2', price: 145 },
    { id: 'epoxy', cat: 'Floor and wall finishes', label: 'Epoxy floor coating, per kilogram', unit: 'kg', price: 42 },
    { id: 'adhesive', cat: 'Floor and wall finishes', label: 'Tile adhesive, 20 kg bag', unit: 'bag', price: 85 },
    { id: 'grout', cat: 'Floor and wall finishes', label: 'Grout, 5 kg bag', unit: 'bag', price: 45 },
    { id: 'claddingPanel', cat: 'External works', label: 'Aluminium composite cladding panel, per m2', unit: 'm2', price: 310 },
    { id: 'paint', cat: 'Paint', label: 'Vinyl emulsion paint, 20 litre drum', unit: 'drum', price: 850 },
    { id: 'glossPaint', cat: 'Paint', label: 'Gloss paint, 20 litre drum', unit: 'drum', price: 920 },
    { id: 'primerPaint', cat: 'Paint', label: 'Primer / sealer, 20 litre drum', unit: 'drum', price: 780 },
    { id: 'flushDoor', cat: 'Doors and windows', label: 'Flush door, 813 x 2032 mm, complete', unit: 'No.', price: 1450 },
    { id: 'panelDoor', cat: 'Doors and windows', label: 'Panelled hardwood door, complete', unit: 'No.', price: 2400 },
    { id: 'steelDoor', cat: 'Doors and windows', label: 'Steel security door, complete', unit: 'No.', price: 3200 },
    { id: 'aluWindow', cat: 'Doors and windows', label: 'Aluminium sliding window, glazed, per m2', unit: 'm2', price: 950 },
    { id: 'glass', cat: 'Doors and windows', label: 'Glazing, 6 mm, per m2', unit: 'm2', price: 420 },
    { id: 'ironmongerySet', cat: 'Doors and windows', label: 'Ironmongery set (locks, hinges, handles)', unit: 'No.', price: 380 },
    { id: 'pvc110', cat: 'Plumbing and drainage', label: 'PVC soil pipe, 110 mm, 3 m length', unit: 'No.', price: 55 },
    { id: 'pvc50', cat: 'Plumbing and drainage', label: 'PVC waste pipe, 50 mm, 3 m length', unit: 'No.', price: 28 },
    { id: 'ppr20', cat: 'Plumbing and drainage', label: 'PPR water pipe, 20 mm, 3 m length', unit: 'No.', price: 24 },
    { id: 'wcSuite', cat: 'Plumbing and drainage', label: 'WC suite, close-coupled, complete', unit: 'No.', price: 950 },
    { id: 'basinSet', cat: 'Plumbing and drainage', label: 'Wash hand basin and fittings', unit: 'No.', price: 420 },
    { id: 'sinkSet', cat: 'Plumbing and drainage', label: 'Kitchen sink and tap', unit: 'No.', price: 520 },
    { id: 'showerSet', cat: 'Plumbing and drainage', label: 'Shower mixer and rose', unit: 'No.', price: 480 },
    { id: 'floorGully', cat: 'Plumbing and drainage', label: 'Floor gully / trap', unit: 'No.', price: 85 },
    { id: 'waterTank', cat: 'Plumbing and drainage', label: 'Water storage tank, 1,000 litres', unit: 'No.', price: 1450 },
    { id: 'pump', cat: 'Plumbing and drainage', label: 'Booster pump, 0.5 hp', unit: 'No.', price: 1250 },
    { id: 'septicUnit', cat: 'Plumbing and drainage', label: 'Septic tank, 10-user, complete', unit: 'No.', price: 5200 },
    { id: 'pvc160', cat: 'Plumbing and drainage', label: 'PVC pipe, 160 mm, 6 m length', unit: 'No.', price: 165 },
    { id: 'manholeCover', cat: 'Plumbing and drainage', label: 'Manhole cover and frame, 600 x 600 mm, heavy duty cast iron', unit: 'No.', price: 780 },
    { id: 'conduit', cat: 'Electrical', label: 'PVC conduit, 20 mm, 3 m length', unit: 'No.', price: 9 },
    { id: 'cable25', cat: 'Electrical', label: 'PVC cable 2.5 mm2, 100 m coil', unit: 'coil', price: 480 },
    { id: 'cable4', cat: 'Electrical', label: 'PVC cable 4 mm2, 100 m coil', unit: 'coil', price: 720 },
    { id: 'dbBoard', cat: 'Electrical', label: 'Distribution board, 8-way', unit: 'No.', price: 420 },
    { id: 'socketSet', cat: 'Electrical', label: 'Socket outlet and box', unit: 'No.', price: 38 },
    { id: 'switchSet', cat: 'Electrical', label: 'Light switch and box', unit: 'No.', price: 32 },
    { id: 'lightFitting', cat: 'Electrical', label: 'Light fitting', unit: 'No.', price: 95 },
    { id: 'earthRod', cat: 'Electrical', label: 'Earth rod and clamp', unit: 'No.', price: 180 },
    { id: 'conduitBox', cat: 'Electrical', label: 'Conduit box / accessory', unit: 'No.', price: 12 },
    { id: 'acUnit', cat: 'Mechanical, fire and energy', label: 'Split air-conditioner, 1 hp', unit: 'No.', price: 3200 },
    { id: 'acDuct', cat: 'Mechanical, fire and energy', label: 'Galvanised ductwork, per metre', unit: 'm', price: 95 },
    { id: 'fan', cat: 'Mechanical, fire and energy', label: 'Extract fan', unit: 'No.', price: 680 },
    { id: 'fireExt', cat: 'Mechanical, fire and energy', label: 'Fire extinguisher, 6 kg', unit: 'No.', price: 320 },
    { id: 'smokeDet', cat: 'Mechanical, fire and energy', label: 'Smoke detector', unit: 'No.', price: 180 },
    { id: 'hydrant', cat: 'Mechanical, fire and energy', label: 'Fire hydrant and hose reel', unit: 'No.', price: 1450 },
    { id: 'genSet', cat: 'Mechanical, fire and energy', label: 'Generator set, 10 kVA', unit: 'No.', price: 18000 },
    { id: 'solarPanel', cat: 'Mechanical, fire and energy', label: 'Solar panel, 400 W', unit: 'No.', price: 1250 },
    { id: 'battery', cat: 'Mechanical, fire and energy', label: 'Battery, 200 Ah', unit: 'No.', price: 2100 },
    { id: 'inverter', cat: 'Mechanical, fire and energy', label: 'Inverter, 3 kW', unit: 'No.', price: 3800 },
    { id: 'gateSet', cat: 'External works', label: 'Steel gate, 3.6 m, complete', unit: 'No.', price: 4800 },
    { id: 'fencePost', cat: 'External works', label: 'Fence post and setting', unit: 'No.', price: 95 },
    { id: 'meshFence', cat: 'External works', label: 'Chain-link fencing, per m2', unit: 'm2', price: 85 },
    { id: 'razorWire', cat: 'External works', label: 'Razor wire, per metre', unit: 'm', price: 18 },
    { id: 'paving', cat: 'External works', label: 'Interlocking paving, per m2', unit: 'm2', price: 145 },
    { id: 'kerb', cat: 'External works', label: 'Concrete kerb, per metre', unit: 'm', price: 65 },
    { id: 'grass', cat: 'External works', label: 'Grass / groundcover, per m2', unit: 'm2', price: 35 },
    { id: 'topsoil', cat: 'External works', label: 'Topsoil, per cubic metre', unit: 'm3', price: 180 },
    { id: 'excavator', cat: 'Plant and equipment', label: 'Excavator (0.8 m3), per day incl. operator and fuel', unit: 'day', price: 1900 },
    { id: 'backhoe', cat: 'Plant and equipment', label: 'Backhoe loader, per day incl. operator and fuel', unit: 'day', price: 1600 },
    { id: 'tipper', cat: 'Plant and equipment', label: 'Tipper lorry, per trip', unit: 'trip', price: 450 },
    { id: 'dumper', cat: 'Plant and equipment', label: 'Site dumper, per day', unit: 'day', price: 700 },
    { id: 'roller', cat: 'Plant and equipment', label: 'Vibrating roller, per day', unit: 'day', price: 900 },
    { id: 'compactor', cat: 'Plant and equipment', label: 'Plate compactor, per day', unit: 'day', price: 320 },
    { id: 'mixer', cat: 'Plant and equipment', label: 'Concrete mixer, per day', unit: 'day', price: 260 },
    { id: 'poker', cat: 'Plant and equipment', label: 'Poker vibrator, per day', unit: 'day', price: 180 },
    { id: 'concPump', cat: 'Plant and equipment', label: 'Concrete pump, per cubic metre', unit: 'm3', price: 120 },
    { id: 'crane', cat: 'Plant and equipment', label: 'Mobile crane, per day', unit: 'day', price: 4500 },
    { id: 'hoist', cat: 'Plant and equipment', label: 'Material hoist, per day', unit: 'day', price: 950 },
    { id: 'scaffold', cat: 'Plant and equipment', label: 'Scaffolding, per m2 per week', unit: 'm2', price: 12 },
    { id: 'waterPump', cat: 'Plant and equipment', label: 'Dewatering pump, per day', unit: 'day', price: 220 },
    { id: 'weldingSet', cat: 'Plant and equipment', label: 'Welding set, per day', unit: 'day', price: 180 },
    { id: 'siteGen', cat: 'Plant and equipment', label: 'Site generator, per day', unit: 'day', price: 350 },
    { id: 'survey', cat: 'Plant and equipment', label: 'Survey equipment and setting out, per day', unit: 'day', price: 450 },
    { id: 'mason', cat: 'Labour', label: 'Mason, daily rate', unit: 'day', price: 200 },
    { id: 'carpenter', cat: 'Labour', label: 'Carpenter / joiner, daily rate', unit: 'day', price: 210 },
    { id: 'steelFixer', cat: 'Labour', label: 'Steel fixer, daily rate', unit: 'day', price: 220 },
    { id: 'plumber', cat: 'Labour', label: 'Plumber, daily rate', unit: 'day', price: 230 },
    { id: 'electrician', cat: 'Labour', label: 'Electrician, daily rate', unit: 'day', price: 230 },
    { id: 'tiler', cat: 'Labour', label: 'Tiler, daily rate', unit: 'day', price: 220 },
    { id: 'painter', cat: 'Labour', label: 'Painter, daily rate', unit: 'day', price: 200 },
    { id: 'labourer', cat: 'Labour', label: 'Labourer daily rate', unit: 'day', price: 120 },
    { id: 'foreman', cat: 'Labour', label: 'Foreman / supervisor, daily rate', unit: 'day', price: 300 },
    { id: 'plantOp', cat: 'Labour', label: 'Plant operator, daily rate', unit: 'day', price: 250 },
    { id: 'minimumWage', cat: 'Labour', label: 'Statutory national daily minimum wage, 2026', unit: 'day', price: 21.77 },
  ];

  const L = (input, qty, note) => ({ input: input, qty: qty, note: note || '' });
  const W = (input, days) => ({ input: input, days: days });
  const F = (id, label, amount) => ({ id: id, label: label, amount: amount });

  /* ---- recipes: quantity of each input per one unit of the bill item ---- */
  /* HOW MANY BLOCKS TO THE SQUARE METRE
     The catalogue carries every sandcrete block at a nominal 450 × 225 mm on
     the face, whatever its thickness — the 100 mm block and the 225 mm block
     are the same length and height.  With a 10 mm mortar joint the module is
     460 × 235 mm, so a square metre of wall takes 1 / (0.46 × 0.235) = 9.25
     blocks; allowing 5 % for cutting and breakage, 9.71 blocks are bought for
     every square metre.  A 12.5 block metre would need a 400 × 200 block laid
     jointless — 35 % more block than the wall can hold. */
  const BLOCKS_PER_M2 = 9.71;
  const BLOCK_NOTE = 'blocks, 9.7 per m2 incl. joints and waste';

  const blockWall = (blockInput, title) => ({
    title: title, oh: 8,
    lines: [L(blockInput, BLOCKS_PER_M2, BLOCK_NOTE), L('cement32', 0.35, 'mortar'), L('sand', 0.035, 'mortar sand')],
    labour: [W('mason', 0.16), W('labourer', 0.05)],
    fixed: [F('sundries', 'Scaffolding, tools and sundries', 6)]
  });
  const concrete = (title, bags, oh) => ({
    title: title, oh: oh || 8,
    lines: [L('cement32', bags, bags <= 5 ? '1:3:6 mix' : '1:2:4 mix'), L('sand', 0.45, 'fine aggregate'), L('aggregate', 0.9, 'coarse aggregate')],
    labour: [W('mason', 0.8), W('labourer', 1.2)],
    fixed: [F('plant', 'Mixer, poker vibrator and water', 95)]
  });

  const RECIPES = {
    /* ---------------- masonry ---------------- */
    block: blockWall('block150', '150 mm sandcrete block wall'),
    balustrade: blockWall('block150', 'Block balustrade to verandah'),
    parapet: blockWall('block150', 'Block parapet wall'),
    block225: blockWall('block225', '225 mm sandcrete block wall'),
    fdnWall: blockWall('block225', '225 mm block foundation wall'),

    /* ---------------- concrete ---------------- */
    fdnConc: {
      title: 'Strip foundation concrete 1:3:6', oh: 8,
      lines: [L('cement32', 6.0, 'about 6 bags per m3'), L('sand', 0.45, 'fine aggregate'), L('aggregate', 0.9, 'coarse aggregate')],
      labour: [W('mason', 0.5), W('labourer', 1.0)],
      fixed: [F('plant', 'Mixer, vibrator and water', 85)]
    },
    colBase: concrete('Column base concrete 1:2:4', 7),
    colConc: concrete('Reinforced concrete columns 1:2:4', 7),
    ringBeam: concrete('Reinforced concrete ring beam 1:2:4', 7),
    beamConc: concrete('Reinforced concrete beams 1:2:4', 7),
    lintel: concrete('Reinforced concrete lintels 1:2:4', 7),
    slabConc: concrete('Reinforced concrete suspended slab 1:2:4', 7.5),
    stairConc: (() => {
      const r = concrete('Reinforced concrete stairs 1:2:4', 7.5);
      r.fixed.push(F('formwork', 'Formwork to steps and soffit', 200));
      return r;
    })(),
    raftConc: concrete('Raft foundation concrete 1:2:4', 7),
    oversite: {
      title: 'Oversite concrete with fabric mesh', oh: 8,
      lines: [L('cement32', 5.0, '1:3:6 mix'), L('sand', 0.45, 'fine aggregate'), L('aggregate', 0.9, 'coarse aggregate')],
      labour: [W('mason', 0.6), W('labourer', 1.0)],
      fixed: [F('mesh', 'A142 fabric mesh and spacers', 60), F('plant', 'Mixer, poker and water', 60)]
    },

    /* ---------------- steel and formwork ---------------- */
    rebar: {
      title: 'High-yield reinforcement, cut, bent and fixed', oh: 8,
      lines: [L('rebar', 0.00105, 'steel per kg with laps and waste')],
      labour: [W('mason', 0.004), W('labourer', 0.004)],
      fixed: [F('wire', 'Binding wire, spacers and cutters', 0.55)]
    },
    mesh: {
      title: 'A142 fabric reinforcement', oh: 8,
      lines: [L('rebar', 0.00305, '3.05 kg per m2')],
      labour: [W('mason', 0.02), W('labourer', 0.02)],
      fixed: [F('wire', 'Binding wire and spacers', 1)]
    },
    formwork: {
      title: 'Formwork to concrete, erected and struck', oh: 8,
      lines: [L('hardwood', 0.015, 'timber, re-used four times')],
      labour: [W('mason', 0.15), W('labourer', 0.05)],
      fixed: [F('sundries', 'Nails, oil and release agent', 6)]
    },

    /* ---------------- earthworks ---------------- */
    excTrench: {
      title: 'Trench excavation, backfilled and carted away', oh: 8,
      lines: [L('excavator', 0.02, 'machine trenching, 50 m3/day'), L('tipper', 0.04, 'cart away'),
              L('waterPump', 0.01, 'dewatering')],
      labour: [W('mason', 0.05), W('labourer', 0.15)],
      fixed: [F('trim', 'Trim to formation and disposal', 6)]
    },
    excPit: {
      title: 'Pit excavation for column bases', oh: 8,
      lines: [L('excavator', 0.024, 'machine digging'), L('tipper', 0.03, 'cart away')],
      labour: [W('mason', 0.05), W('labourer', 0.2)],
      fixed: [F('trim', 'Trim, dewater and backfill edges', 4)]
    },
    backfill: {
      title: 'Backfilling in layers, compacted', oh: 8,
      lines: [L('compactor', 0.05, 'plate compactor'), L('waterPump', 0.01, 'water for compaction')],
      labour: [W('mason', 0.02), W('labourer', 0.2)],
      fixed: []
    },
    hardcore: {
      title: 'Hardcore filling, well rammed', oh: 8,
      lines: [L('aggregate', 1.15, 'hardcore, with consolidation allowance'),
              L('compactor', 0.06, 'plate compactor')],
      labour: [W('mason', 0.03), W('labourer', 0.25)],
      fixed: []
    },

    /* ---------------- manholes and drainage ----------------
       A manhole is a small building: dig, blind, base, block walls, render
       inside, bench the invert, bed the cover, backfill. A drain is a
       trench, a bed, the pipe, the backfill and a test. Every recipe is
       per one unit of the bill item, so a changed length or a changed
       count moves the whole build-up with it. */
    excManhole: {
      title: 'Manhole excavation, trimmed and carted away', oh: 8,
      lines: [L('excavator', 0.03, 'machine digging in the working space'), L('tipper', 0.05, 'cart away'),
              L('waterPump', 0.01, 'dewatering')],
      labour: [W('mason', 0.08), W('labourer', 0.30)],
      fixed: [F('trim', 'Trim to formation and disposal', 8)]
    },
    mhBlind: {
      title: 'Blinding concrete to manhole bases', oh: 8,
      lines: [L('cement32', 4.2, 'grade 15, about 4 bags per m3'), L('sand', 0.45, 'fine aggregate'),
              L('aggregate', 0.9, 'coarse aggregate')],
      labour: [W('mason', 0.35), W('labourer', 0.80)],
      fixed: [F('plant', 'Mixer and water', 55)]
    },
    mhBase: {
      title: 'Reinforced concrete manhole base 1:2:4', oh: 8,
      lines: [L('cement32', 7.0, '1:2:4 mix'), L('sand', 0.45, 'fine aggregate'), L('aggregate', 0.9, 'coarse aggregate')],
      labour: [W('mason', 0.9), W('labourer', 1.3)],
      fixed: [F('mesh', 'A142 fabric mesh and spacers', 55), F('plant', 'Mixer, poker vibrator and water', 95)]
    },
    mhWall: blockWall('block225', '225 mm sandcrete block manhole walls'),
    mhRender: {
      title: 'Cement and sand render to the inside of manholes', oh: 8,
      lines: [L('cement32', 0.28, '1:3 mix'), L('plasterSand', 0.025, 'fine sand')],
      labour: [W('mason', 0.22), W('labourer', 0.07)],
      fixed: [F('sundries', 'Scaffolding, tools and curing', 5)]
    },
    mhBench: {
      title: 'Benching and channel to the manhole invert', oh: 8,
      lines: [L('cement32', 7.0, '1:2:4 mix'), L('sand', 0.45, 'fine aggregate'), L('aggregate', 0.9, 'coarse aggregate')],
      labour: [W('mason', 1.1), W('labourer', 1.5)],
      fixed: [F('benching', 'Forming the channel and benching to falls', 140),
              F('plant', 'Mixer, vibrator and float', 110)]
    },
    mhCover: {
      title: 'Heavy duty manhole cover and frame, bedded', oh: 8,
      lines: [L('manholeCover', 1, 'cover and frame')],
      labour: [W('mason', 0.12), W('labourer', 0.12)],
      fixed: [F('sealant', 'Mortar bedding and sealant', 35)]
    },
    drainExc: {
      title: 'Trench excavation for drains, trimmed and carted away', oh: 8,
      lines: [L('excavator', 0.008, 'machine trenching'), L('tipper', 0.012, 'cart away')],
      labour: [W('labourer', 0.15)],
      fixed: [F('trim', 'Trim to falls and disposal', 4)]
    },
    drainBed: {
      title: 'Sand bedding to drain pipes, levelled to falls', oh: 8,
      lines: [L('beddingMat', 1.06, 'bedding with compaction allowance'), L('sand', 0.02, 'blinding sand')],
      labour: [W('plumber', 0.04), W('labourer', 0.10)],
      fixed: []
    },
    pipe110: {
      title: '110 mm uPVC drain pipe, laid to falls', oh: 8,
      lines: [L('pvc110', 0.36, '3 m lengths with joints')],
      labour: [W('plumber', 0.07), W('labourer', 0.05)],
      fixed: [F('fittings', 'Couplings, bends, junctions and solvent cement', 7)]
    },
    pipe160: {
      title: '160 mm uPVC drain pipe, laid to falls', oh: 8,
      lines: [L('pvc160', 0.18, '6 m lengths with joints')],
      labour: [W('plumber', 0.08), W('labourer', 0.06)],
      fixed: [F('fittings', 'Couplings, bends and solvent cement', 9)]
    },
    drainBack: {
      title: 'Backfilling drain trenches in layers, compacted', oh: 8,
      lines: [L('compactor', 0.03, 'plate compactor')],
      labour: [W('labourer', 0.12)],
      fixed: []
    },
    mhBack: {
      title: 'Backfilling around manholes in layers, compacted', oh: 8,
      lines: [L('compactor', 0.04, 'plate compactor')],
      labour: [W('labourer', 0.14)],
      fixed: []
    },
    drainTest: {
      title: 'Testing and commissioning the drainage', oh: 8,
      lines: [], labour: [W('plumber', 0.04), W('labourer', 0.04)],
      fixed: [F('testing', 'Water for flushing, balls and making good', 3)]
    },

    /* ---------------- roof ---------------- */
    roofSheet: {
      title: 'Long-span roofing sheet, laid', oh: 8,
      lines: [L('roofSheet', 1.02, 'sheet with end and side laps')],
      labour: [], fixed: [F('fixings', 'Screws, washers and sealant', 4)]
    },
    purlin: {
      title: 'Timber purlin, fixed', oh: 8,
      lines: [L('hardwood', 0.012, 'timber')],
      labour: [W('mason', 0.06)], fixed: [F('nails', 'Nails, straps and priming', 4)]
    },
    ridge: {
      title: 'Ridge capping', oh: 8,
      lines: [L('hardwood', 0.006, 'timber')],
      labour: [W('mason', 0.06)], fixed: [F('capping', 'Ridge capping, sealant and fixings', 60)]
    },
    fascia: {
      title: 'Fascia board', oh: 8,
      lines: [L('hardwood', 0.008, 'timber')],
      labour: [W('mason', 0.06)], fixed: [F('sundries', 'Primer, fixings and scaffolding', 52)]
    },
    barge: {
      title: 'Barge board', oh: 8,
      lines: [L('hardwood', 0.007, 'timber')],
      labour: [W('mason', 0.06)], fixed: [F('sundries', 'Primer, fixings and scaffolding', 35)]
    },

    /* ---------------- finishes ---------------- */
    terrazzo: {
      title: '25 mm terrazzo floor finish', oh: 10,
      lines: [L('cement42', 0.30, 'white / grey cement'), L('terrazzoChip', 0.025, 'granite chippings')],
      labour: [],
      fixed: [F('specialist', 'Terrazzo specialist labour, grinding and polishing', 130),
              F('pigment', 'Pigment, divider strips and curing', 18)]
    },
    plaster: {
      title: '12 mm plaster to walls', oh: 10,
      lines: [L('cement32', 0.16, 'mortar'), L('sand', 0.018, 'mortar sand')],
      labour: [W('mason', 0.13), W('labourer', 0.03)],
      fixed: [F('sundries', 'Sundries and scaffolding', 8)]
    },
    render: {
      title: '15 mm cement and sand render, external', oh: 10,
      lines: [L('cement32', 0.2, 'mortar'), L('sand', 0.022, 'mortar sand')],
      labour: [W('mason', 0.14), W('labourer', 0.04)],
      fixed: [F('sundries', 'Scaffolding and sundries', 10)]
    },
    screed: {
      title: '40 mm cement and sand screed', oh: 10,
      lines: [L('cement32', 0.25, '1:4 mix'), L('sand', 0.03, '1:4 mix')],
      labour: [W('mason', 0.12)],
      fixed: [F('sundries', 'Curing and sundries', 2)]
    },
    flatScreed: {
      title: 'Power-float screed to roof', oh: 10,
      lines: [L('cement32', 0.25, '1:4 mix'), L('sand', 0.03, '1:4 mix'), L('primerWP', 0.05, 'integral waterproofing')],
      labour: [W('mason', 0.14)],
      fixed: [F('sundries', 'Curing, power float and sundries', 30)]
    },
    tiles: {
      title: 'Ceramic floor tiles on mortar bed', oh: 10,
      lines: [L('tiles', 1.05, 'tiles with cutting waste'), L('adhesive', 0.4, 'adhesive'), L('cement32', 0.12, 'mortar bed')],
      labour: [W('mason', 0.25), W('labourer', 0.10)],
      fixed: [F('grout', 'Grout, spacers and cleaning', 8)]
    },
    wallTile: {
      title: 'Ceramic wall tiles', oh: 10,
      lines: [L('tiles', 1.05, 'tiles with cutting waste'), L('adhesive', 0.5, 'adhesive'), L('cement32', 0.12, 'mortar backing')],
      labour: [W('mason', 0.30), W('labourer', 0.12)],
      fixed: [F('grout', 'Grout, spacers and cleaning', 8)]
    },
    skirting: {
      title: '100 mm skirting', oh: 10,
      lines: [L('tiles', 0.10, 'skirting units'), L('adhesive', 0.05, 'adhesive'), L('cement32', 0.02, 'mortar')],
      labour: [W('tiler', 0.08)],
      fixed: [F('sundries', 'Sundries and cleaning', 2)]
    },
    cornice: {
      title: '65 mm cornice', oh: 10,
      lines: [], labour: [W('mason', 0.03)],
      fixed: [F('materials', 'Cornice sections and adhesive', 15)]
    },
    paintInt: {
      title: 'Two coats emulsion paint, internal', oh: 10,
      lines: [L('paint', 0.02, '20 L drum covers about 60 m2 per coat')],
      labour: [W('painter', 0.045)],
      fixed: [F('sundries', 'Brushes, rollers and masking', 1.2)]
    },
    paintExt: {
      title: 'Two coats emulsion paint, external', oh: 10,
      lines: [L('paint', 0.028, 'drum covers about 60 m2 per coat')],
      labour: [W('painter', 0.05)],
      fixed: [F('sundries', 'Brushes, rollers and masking', 2)]
    },
    gloss: {
      title: 'Gloss paint to wood and metal', oh: 10,
      lines: [L('glossPaint', 0.02, 'gloss, two coats'), L('primerPaint', 0.008, 'primer coat')],
      labour: [W('painter', 0.06)],
      fixed: [F('sundries', 'Brushes, thinners and masking', 4)]
    },

    /* ---------------- site, water and ground ---------------- */
    siteClear: {
      title: 'Site clearance, grubbing, levelling and cart away', oh: 8,
      lines: [], labour: [W('plantOp', 0.012), W('labourer', 0.08)],
      fixed: [F('plant', 'Excavator, tipper and clearing plant', 29)]
    },
    dpm: {
      title: 'Damp-proof membrane on sand bed', oh: 8,
      lines: [L('sand', 0.03, '25 mm sand blinding'), L('polythene', 1.1, '500 gauge, lapped')],
      labour: [W('labourer', 0.02)],
      fixed: [F('tape', 'Tape and laps', 2)]
    },
    termite: {
      title: 'Termite treatment to oversite and foundations', oh: 8,
      lines: [L('termiticide', 0.2, 'diluted chemical, two coats')],
      labour: [W('labourer', 0.03)],
      fixed: [F('spray', 'Sprayer and protective wear', 3)]
    },

    /* ---------------- roof structure and covering ---------------- */
    truss: {
      title: 'Fabricated timber roof truss, delivered and erected', oh: 8,
      lines: [L('softwood', 0.22, 'structural timber, stress graded'), L('plywood', 0.6, 'gusset plates')],
      labour: [W('carpenter', 0.8), W('labourer', 0.3)],
      fixed: [F('plates', 'Galvanised plates, straps and nails', 120),
              F('delivery', 'Fabrication and delivery', 60)]
    },
    waterproof: {
      title: 'Torch-on waterproof membrane to roof', oh: 8,
      lines: [L('membrane', 1.1, 'membrane with laps'), L('primerWP', 0.08, 'primer')],
      labour: [W('mason', 0.12)],
      fixed: [F('seal', 'Lap sealing and details', 4)]
    },

    /* ---------------- ceilings ---------------- */
    ceiling: {
      title: 'PVC ceiling boards on timber battens', oh: 8,
      lines: [L('pvcBoard', 1.05, 'boards with waste')],
      labour: [W('carpenter', 0.1)],
      fixed: [F('battens', 'Battens, trims and fixings', 20)]
    },
    ceilingPB: {
      title: 'Plasterboard ceiling on metal frame', oh: 8,
      lines: [L('ceilingBoard', 1.05, 'boards with waste')],
      labour: [W('carpenter', 0.1)],
      fixed: [F('frame', 'Metal frame and hangers', 14), F('screws', 'Screws and joint tape', 8),
              F('filler', 'Joint filler and skim', 2)]
    },
    ceilingPOP: {
      title: 'POP ceiling on mesh, including cornice', oh: 8,
      lines: [L('popPowder', 0.5, 'POP'), L('mesh', 1.05, 'backing mesh')],
      labour: [W('carpenter', 0.1)],
      fixed: [F('specialist', 'POP specialist labour and scaffolding', 75),
              F('sundries', 'Cornice, beads and sundries', 15)]
    },
    ceilingGrid: {
      title: 'Mineral fibre suspended ceiling, T-grid', oh: 8,
      lines: [L('mineralTile', 2.9, 'tiles, 600 x 600'), L('gridMain', 0.35, 'main runners'),
              L('gridCross', 0.9, 'cross tees')],
      labour: [W('carpenter', 0.12)],
      fixed: [F('hangers', 'Hangers, wire and edge trim', 9)]
    },
    ceilingFC: {
      title: 'Fibre cement ceiling boards on battens', oh: 8,
      lines: [L('fibreBoard', 1.05, 'boards with waste')],
      labour: [W('carpenter', 0.12)],
      fixed: [F('battens', 'Battens and trims', 12), F('screws', 'Screws and washers', 8),
              F('jointing', 'Jointing and skimming', 6)]
    },
    ceilingTimber: {
      title: 'Timber ceiling boards, varnished', oh: 8,
      lines: [L('timberBoard', 1.08, 'boards with waste')],
      labour: [W('carpenter', 0.15)],
      fixed: [F('battens', 'Battens and fixings', 19), F('varnish', 'Varnish, two coats', 25)]
    },
    hatch: {
      title: 'Roof access hatch', oh: 8,
      lines: [L('hatchSet', 1, 'hatch and frame')],
      labour: [W('carpenter', 0.3)],
      fixed: [F('frame', 'Trimming and flashing', 45), F('sundries', 'Sealant and ironmongery', 15)]
    },

    /* ---------------- finishes ---------------- */
    porcelain: {
      title: 'Porcelain floor tiles on adhesive', oh: 10,
      lines: [L('porcelain', 1.05, 'tiles with cutting waste'), L('adhesive', 0.5, 'adhesive'),
              L('cement32', 0.12, 'mortar bed')],
      labour: [W('tiler', 0.3)],
      fixed: [F('grout', 'Grout, spacers and cleaning', 10)]
    },
    granite: {
      title: 'Granite floor tiles, laid and polished', oh: 10,
      lines: [L('granite', 1.05, 'slabs with cutting waste')],
      labour: [W('tiler', 0.4)],
      fixed: [F('mortar', 'Mortar bed and adhesive', 45), F('polish', 'Polishing and sealing', 25)]
    },
    laminate: {
      title: 'Laminate flooring on underlay', oh: 10,
      lines: [L('laminate', 1.05, 'boards with waste'), L('polythene', 1.05, 'underlay')],
      labour: [W('carpenter', 0.15)],
      fixed: [F('trims', 'Skirting trims and thresholds', 8)]
    },
    vinyl: {
      title: 'Vinyl sheet flooring', oh: 10,
      lines: [L('vinyl', 1.05, 'sheet with waste'), L('adhesive', 0.25, 'adhesive')],
      labour: [W('tiler', 0.12)],
      fixed: [F('sundries', 'Welding rod and cleaning', 5)]
    },
    carpet: {
      title: 'Carpet tiles on underlay', oh: 10,
      lines: [L('carpet', 1.05, 'tiles with waste')],
      labour: [W('carpenter', 0.08)],
      fixed: [F('underlay', 'Underlay and gripper', 21)]
    },
    epoxy: {
      title: 'Epoxy floor coating', oh: 10,
      lines: [L('epoxy', 3, 'resin, 3 kg per m2'), L('primerWP', 0.15, 'primer')],
      labour: [W('painter', 0.08)],
      fixed: [F('sundries', 'Aggregate scatter and tools', 6)]
    },
    wood: {
      title: 'Timber strip flooring, sanded and varnished', oh: 10,
      lines: [L('woodFloor', 1.08, 'strips with waste')],
      labour: [W('carpenter', 0.2)],
      fixed: [F('joists', 'Battens and fixings', 24), F('varnish', 'Varnish, three coats', 12)]
    },
    cladding: {
      title: 'Aluminium composite cladding on framing', oh: 10,
      lines: [L('claddingPanel', 1.05, 'panels with waste')],
      labour: [W('mason', 0.15)],
      fixed: [F('frame', 'Framing and brackets', 35), F('fixings', 'Rivets, sealant and trims', 15)]
    },
    boundary: {
      title: 'Boundary wall in 150 mm blockwork', oh: 8,
      lines: [L('block150', BLOCKS_PER_M2, BLOCK_NOTE), L('cement32', 0.4, 'mortar'),
              L('sand', 0.04, 'mortar sand')],
      labour: [W('mason', 0.18), W('labourer', 0.06)],
      fixed: [F('coping', 'Coping, pillars and render', 25)]
    }
  };

  /* hip capping is ridge capping turned on the corner: the same section, the
     same bedding, so it is the same build-up under its own key */
  RECIPES.hip = RECIPES.ridge;
  RECIPES.valley = {
    title: 'Valley flashing and lining', oh: 8,
    lines: [L('hardwood', 0.004, 'timber')],
    labour: [W('mason', 0.08)], fixed: [F('valley', 'Valley lining, sealant and fixings', 96)]
  };

  /* ----------------------------------------------------------------
     THE SPECIFICATION IN THE DESCRIPTION
     A take-off description is written the way the Standard Method of
     Measurement writes it — the mix, the thickness, the depth. Those
     words are the specification of the work, so they drive the
     build-up: rewrite 1:2:4 as 1:3:6 and the cement follows, 12 mm as
     18 mm and the plaster follows, deepen a trench and the digging
     follows. The quantities below are the basis of the conversion, and
     every change is written out so the sheet can say what it did.
     ---------------------------------------------------------------- */

  /* bags of cement in one cubic metre of concrete, by mix (50 kg bags,
     Ghana practice: 7 bags to 1:2:4, 6 to 1:3:6) */
  const CEMENT_BAGS = [
    { x: 0.2500, bags: 9.6 },   // 1:1:2
    { x: 0.1818, bags: 8.4 },   // 1:1.5:3
    { x: 0.1667, bags: 7.9 },   // 1:2:3
    { x: 0.1429, bags: 7.0 },   // 1:2:4
    { x: 0.1250, bags: 6.5 },   // 1:2.5:3.5
    { x: 0.1111, bags: 6.3 },   // 1:3:5
    { x: 0.1000, bags: 6.0 },   // 1:3:6
    { x: 0.0769, bags: 4.6 },   // 1:4:8
    { x: 0.0625, bags: 3.8 }    // 1:5:10
  ];
  const mixParts = mix => String(mix || '').split(':').map(Number).filter(n => n > 0);
  function bagsPerM3(mix) {
    const parts = mixParts(mix);
    if (parts.length < 2) return null;
    const x = parts[0] / parts.reduce((a, b) => a + b, 0);
    for (let i = 0; i < CEMENT_BAGS.length - 1; i++) {
      const hi = CEMENT_BAGS[i], lo = CEMENT_BAGS[i + 1];
      if (x <= hi.x && x >= lo.x) {
        const f = (x - lo.x) / (hi.x - lo.x);
        return lo.bags + (hi.bags - lo.bags) * f;
      }
    }
    return x > CEMENT_BAGS[0].x ? CEMENT_BAGS[0].bags : CEMENT_BAGS[CEMENT_BAGS.length - 1].bags;
  }

  /* which recipes the description specifies, and the specification the
     recipe itself was priced on */
  const SPECS = {
    /* concrete, per m3 — the mix decides cement, sand and chippings */
    fdnConc:   { kind: 'concrete', mix: '1:3:6' },
    oversite:  { kind: 'concrete', mix: '1:3:6' },
    colBase:   { kind: 'concrete', mix: '1:2:4' },
    colConc:   { kind: 'concrete', mix: '1:2:4' },
    ringBeam:  { kind: 'concrete', mix: '1:2:4' },
    beamConc:  { kind: 'concrete', mix: '1:2:4' },
    lintel:    { kind: 'concrete', mix: '1:2:4' },
    slabConc:  { kind: 'concrete', mix: '1:2:4' },
    stairConc: { kind: 'concrete', mix: '1:2:4' },
    raftConc:  { kind: 'concrete', mix: '1:2:4' },
    mhBase:    { kind: 'concrete', mix: '1:2:4' },
    mhBench:   { kind: 'concrete', mix: '1:2:4' },
    mhBlind:   { kind: 'concrete', mix: '1:3:6' },

    /* coats, per m2 — thickness and mix */
    plaster:    { kind: 'coat', mix: '1:4', thick: 12 },
    render:     { kind: 'coat', mix: '1:4', thick: 15 },
    screed:     { kind: 'coat', mix: '1:4', thick: 40 },
    flatScreed: { kind: 'coat', mix: '1:4', thick: 60 },
    terrazzo:   { kind: 'coat', thick: 25 },
    mhRender:   { kind: 'coat', mix: '1:3', thick: 15 },

    /* blockwork, per m2 — the wall thickness and the mortar mix */
    block:      { kind: 'block', mix: '1:4' },
    balustrade: { kind: 'block', mix: '1:4' },
    parapet:    { kind: 'block', mix: '1:4' },
    boundary:   { kind: 'block', mix: '1:4' },
    mhWall:     { kind: 'block', mix: '1:4' },
    block225:   { kind: 'block', mix: '1:4' },
    fdnWall:    { kind: 'block', mix: '1:4' },

    /* digging, per m3 — the depth decides the time */
    excTrench: { kind: 'depth', depth: 1.5 },
    excPit:    { kind: 'depth', depth: 1.5 },
    excManhole: { kind: 'depth', depth: 1.5 },
    drainExc:   { kind: 'depth', depth: 1.5 }
  };

  const BLOCK_BY_THICK = { 100: 'block100', 115: 'block100', 125: 'block100', 140: 'block150',
                           150: 'block150', 200: 'block225', 225: 'block225', 230: 'block225',
                           250: 'block225', 300: 'block300', 305: 'block300' };
  const BLOCK_THICK = { block100: 100, block150: 150, block225: 225, block300: 300, brick: 100 };

  function parseSpec(desc) {
    const low = String(desc || '').toLowerCase().replace(/\u00a0/g, ' ');
    const out = { mix: null, thick: null, depth: null };
    /* the mix ratio — 1:2:4, 1:3:6, 1:4 — the first one in the sentence */
    const mx = low.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)(?:\s*:\s*(\d+(?:\.\d+)?))?/);
    if (mx) out.mix = mx[3] ? (mx[1] + ':' + mx[2] + ':' + mx[3]) : (mx[1] + ':' + mx[2]);
    /* thickness in millimetres: "12 mm thick", "thickness 12 mm", "average 60 mm" */
    const num = '\\d[\\d,]*(?:\\.\\d+)?';
    /* "thick" wins over "wide" — a 600 mm wide footing is not a 600 mm coat */
    const th = low.match(new RegExp('(' + num + ')\\s*mm\\s*thick\\b'))
      || low.match(new RegExp('\\bthick(?:ness)?\\s*(?:of\\s*|:\\s*)?(' + num + ')\\s*mm\\b'))
      || low.match(new RegExp('\\baverage\\s+(' + num + ')\\s*mm\\b'))
      || low.match(new RegExp('(' + num + ')\\s*mm\\s*deep\\b'))
      || low.match(new RegExp('(' + num + ')\\s*mm\\s+(?:sandcrete|hollow|concrete|clay)\\s*blocks?\\b'))
      || low.match(new RegExp('(' + num + ')\\s*mm\\s+(?:\\w+\\s+)?(?:terrazzo|granite|marble|porcelain|tiles?|screed|render|plaster|paving|finish|bed)\\b'))
      || low.match(new RegExp('(' + num + ')\\s*mm\\s*(?:wide|high)\\b'));
    if (th) out.thick = Number(String(th[1]).replace(/,/g, ''));
    /* depth in metres: "depth not exceeding 1.50 m" — millimetres are not metres */
    const dp = low.match(new RegExp('\\bdepth\\s*(?:not\\s+exceeding|of|up\\s+to|exceeding|:\\s*)?\\s*(' + num + ')\\s*(mm|m)\\b'));
    if (dp) out.depth = Number(String(dp[1]).replace(/,/g, '')) / (dp[2] === 'mm' ? 1000 : 1);
    return out;
  }

  /* the specification a recipe was priced on, read from the recipe itself */
  function baseSpec(key) {
    const sp = SPECS[key], r = recipe(key);
    if (!sp || !r) return null;
    const out = { kind: sp.kind, mix: sp.mix || null, thick: sp.thick || null, depth: sp.depth || null, block: null };
    if (sp.kind === 'block') {
      const line = (r.lines || []).find(l => BLOCK_THICK[l.input]);
      if (line) { out.block = line.input; out.thick = BLOCK_THICK[line.input]; }
    }
    return out;
  }

  /* what the description asks for, compared with what the recipe priced */
  function specUse(key, desc) {
    const base = baseSpec(key);
    if (!base) return null;
    const now = parseSpec(desc);
    const use = {
      key: key, kind: base.kind, base: base, now: now,
      mixNow: now.mix || base.mix, thickNow: now.thick || base.thick, depthNow: now.depth || base.depth,
      swap: {}, factors: {}, lineNote: {}, notes: [], changed: false
    };
    const note = txt => { if (use.notes.indexOf(txt) < 0) use.notes.push(txt); };

    const mortarFactor = (mixNow, mixBase) => {
      const a = mixParts(mixNow), b = mixParts(mixBase);
      if (a.length < 2 || b.length < 2) return { cement: 1, sand: 1 };
      const ta = a.reduce((x, y) => x + y, 0), tb = b.reduce((x, y) => x + y, 0);
      return { cement: (a[0] / ta) / (b[0] / tb),
               sand: (a.length > 1 ? a[1] / ta : 0) / (b.length > 1 ? b[1] / tb : 1) };
    };
    const set = (ids, f) => { if (Math.abs(f - 1) > 1e-9) ids.forEach(id => { use.factors[id] = f; }); };

    if (base.kind === 'concrete') {
      if (use.mixNow && base.mix && use.mixNow !== base.mix) {
        const bags = bagsPerM3(use.mixNow), bags0 = bagsPerM3(base.mix);
        if (bags && bags0) {
          const k = Math.max(0.5, Math.min(2.2, bags / bags0));
          set(['cement32', 'cement42'], k);
          note(base.mix + ' → ' + use.mixNow + ' · cement ' + bags0.toFixed(2) + ' → ' + bags.toFixed(2) + ' bags per m³');
          use.lineNote.cement32 = bags.toFixed(2) + ' bags per m³ (' + use.mixNow + ')';
          use.lineNote.cement42 = use.lineNote.cement32;
        }
        const r = recipe(key);
        const was = id => { const l = ((r && r.lines) || []).find(x => x.input === id); return l ? l.qty : 0; };
        const f = mortarFactor(use.mixNow, base.mix);
        if (Math.abs(f.sand - 1) > 0.001) {
          set(['sand'], f.sand);
          note('sand ' + was('sand').toFixed(3) + ' → ' + (was('sand') * f.sand).toFixed(3) + ' m³ per m³');
          use.lineNote.sand = (was('sand') * f.sand).toFixed(3) + ' m³ per m³ (' + use.mixNow + ')';
        }
        if (mixParts(use.mixNow).length > 2 && mixParts(base.mix).length > 2) {
          const a = mixParts(use.mixNow), b = mixParts(base.mix);
          const ta = a.reduce((x, y) => x + y, 0), tb = b.reduce((x, y) => x + y, 0);
          const fa = (a[2] / ta) / (b[2] / tb);
          if (Math.abs(fa - 1) > 0.001) {
            set(['aggregate'], fa);
            note('aggregate ' + was('aggregate').toFixed(3) + ' → ' + (was('aggregate') * fa).toFixed(3) + ' m³ per m³');
            use.lineNote.aggregate = (was('aggregate') * fa).toFixed(3) + ' m³ per m³ (' + use.mixNow + ')';
          }
        }
      }
    } else if (base.kind === 'coat') {
      const ft = (use.thickNow && base.thick) ? use.thickNow / base.thick : 1;
      const f = base.mix ? mortarFactor(use.mixNow || base.mix, base.mix) : { cement: 1, sand: 1 };
      if (Math.abs(ft - 1) > 1e-9) note(base.thick + ' mm → ' + use.thickNow + ' mm' +
        (base.mix ? ' · materials ' + ft.toFixed(3) + ' ×' : ''));
      if (base.mix && use.mixNow && use.mixNow !== base.mix) note(base.mix + ' → ' + use.mixNow);
      set(['cement32', 'cement42'], ft * f.cement);
      if (base.mix) set(['sand', 'plasterSand'], ft * f.sand);
      if (!base.mix) set(['terrazzoChip', 'cement42'], ft);
      if (use.changed) {
        const txt = (base.mix ? 'mortar ' + (base.mix !== use.mixNow ? use.mixNow : '') : 'material') +
          (use.thickNow ? ' for ' + use.thickNow + ' mm' : '');
        ['cement32', 'cement42', 'sand', 'plasterSand'].forEach(id => { use.lineNote[id] = txt.trim(); });
      }
    } else if (base.kind === 'block') {
      const ft = (base.thick && use.thickNow) ? use.thickNow / base.thick : 1;
      const f = mortarFactor(use.mixNow || base.mix, base.mix);
      const want = use.thickNow ? BLOCK_BY_THICK[Math.round(use.thickNow)] : null;
      if (want && base.block && want !== base.block) {
        use.swap[base.block] = want;
        note(base.thick + ' mm → ' + use.thickNow + ' mm blocks (' + want.replace('block', '') + ' mm)');
      } else if (Math.abs(ft - 1) > 1e-9) {
        note(base.thick + ' mm → ' + use.thickNow + ' mm wall');
      }
      if (base.mix && use.mixNow && use.mixNow !== base.mix) note(base.mix + ' → ' + use.mixNow + ' mortar');
      set(['cement32'], ft * f.cement);
      set(['sand'], ft * f.sand);
      if (Object.keys(use.swap).length) {
        const to = Object.values(use.swap)[0];
        use.lineNote[base.block] = BLOCK_THICK[to] + ' mm blocks to the description';
        use.lineNote.cement32 = 'mortar for a ' + use.thickNow + ' mm wall';
        use.lineNote.sand = 'mortar sand for a ' + use.thickNow + ' mm wall';
      } else if (use.changed) {
        use.lineNote.cement32 = 'mortar for a ' + use.thickNow + ' mm wall';
        use.lineNote.sand = 'mortar sand for a ' + use.thickNow + ' mm wall';
      }
    } else if (base.kind === 'depth') {
      const d0 = base.depth, d1 = use.depthNow;
      if (d1 && d0 && Math.abs(d1 - d0) > 1e-9) {
        const f = Math.max(1, Math.min(2, 1 + 0.15 * (d1 - d0)));
        use.depthFactor = f;
        note(d0.toFixed(2) + ' m → ' + d1.toFixed(2) + ' m deep · digging and labour ' + f.toFixed(2) + ' ×');
      }
    }

    use.changed = use.notes.length > 0 || Object.keys(use.factors).length > 0 || Object.keys(use.swap).length > 0;
    use.note = use.notes.join(' · ');
    use.factorFor = id => (use.factors[id] != null ? use.factors[id] : 1);
    return use;
  }

  /* assessed items: share of the issued rate, editable as amounts.
     The two shares are scaled so that, at the default overheads, the
     computed cost equals the rate the bill already carries. */
  function shares(unit, oh) {
    const s = unit === 'Item' ? { mat: 40, lab: 45 }
            : unit === 'No.' ? { mat: 55, lab: 30 }
            : { mat: 50, lab: 35 };
    const k = (100 / (1 + oh / 100)) / (s.mat + s.lab);
    return { mat: s.mat * k, lab: s.lab * k, oh: oh };
  }

  /* the rate the bill carried before any adoption: the split is taken from
     that figure so that re-adopting can never creep */
  function baseRate(p, e) {
    const o = p && p.rb && p.rb.orig && p.rb.orig[e.key];
    if (o && o.all != null) return o.all;
    return e.rate;
  }

  const r2 = n => Math.round(n * 100) / 100;
  const r6 = n => Math.round(n * 1e6) / 1e6;

  const byId = id => INPUTS.find(i => i.id === id);
  const recipe = key => RECIPES[key];

  function inputPrice(p, id) {
    const rb = (p && p.rb && p.rb.inputs) || {};
    if (rb[id] !== undefined && rb[id] !== null && rb[id] !== '') return Number(rb[id]);
    const i = byId(id);
    return i ? i.price : 0;
  }

  function qtyOf(p, key, input) {
    const o = (p && p.rb && p.rb.qty) || {};
    const v = o[key + '.' + input];
    if (v !== undefined && v !== null && v !== '') return Number(v);
    return null;
  }

  function overheads(p, key, def) {
    const rb = (p && p.rb && p.rb.oh) || {};
    const v = rb[key];
    return (v !== undefined && v !== null && v !== '') ? Number(v) : def;
  }

  function fixedAmount(p, key, f, entry) {
    const rb = (p && p.rb && p.rb.fixed) || {};
    const v = rb[key + '.' + f.id];
    if (v !== undefined && v !== null && v !== '') return Number(v);
    return typeof f.amount === 'function' ? f.amount(entry) : f.amount;
  }

  function uplift(p) {
    return (p && p.template === 'general') ? 1 + (Number(p.opProfitPct) || 0) / 100 : 1;
  }

  /* ----------------------------------------------------------------
     THE LIST — generated from the measured bill, one entry per rate
     ---------------------------------------------------------------- */
  function list(result) {
    const out = [], seen = new Map();
    ((result && result.bills) || []).forEach(b => {
      (b.items || []).forEach((it, i) => {
        if (!it.key) return;                    // balancing preliminaries have no rate
        const amount = (it.amount != null) ? it.amount : it.qty * it.rate;
        if (!(it.qty > 0) || !(amount > 0)) return;
        /* every priced row is kept whole: the material schedule has to be
           able to name the bill and the item it was multiplied out of */
        const part = {
          bill: b.code, title: b.title, no: i + 1, key: it.key,
          desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate, amount: r2(amount)
        };
        const prev = seen.get(it.key);
        if (prev && prev.unit === it.unit) {
          prev.qty = r2(prev.qty + it.qty);
          prev.amount = r2(prev.amount + amount);
          prev.items++;
          prev.parts.push(part);
          return;
        }
        const e = {
          key: it.key, bill: b.code, billTitle: b.title, desc: it.desc, unit: it.unit,
          qty: it.qty, rate: it.rate, baseRate: (it.baseRate != null ? it.baseRate : it.rate),
          amount: r2(amount), items: 1, parts: [part]
        };
        seen.set(it.key, e);
        out.push(e);
      });
    });
    out.sort((a, b) => b.amount - a.amount);
    return out;
  }

  /* ----------------------------------------------------------------
     THE ARITHMETIC for one entry
     ---------------------------------------------------------------- */
  function compute(p, e) {
    if (!e) return null;
    const r = recipe(e.key);
    let lines = [], labour = [], fixed = [], oh, assessed = false;

    let spec = null;
    if (r) {
      /* the description is the specification: mix, thickness and depth
         move the quantities before anything is priced */
      spec = specUse(e.key, e.desc && e.desc !== undefined ? e.desc : '');
      const depthF = (spec && spec.depthFactor) ? spec.depthFactor : 1;
      const plantF = id => {
        const inp = byId(id);
        return depthF !== 1 && inp && /Plant and equipment/.test(inp.cat || '') ? depthF : 1;
      };
      lines = (r.lines || []).map(l => {
        const swapped = spec && spec.swap[l.input];
        const input = swapped || l.input;
        const inp = byId(input) || { label: input, unit: '' };
        const q = swapped ? null : qtyOf(p, e.key, l.input);
        const f = spec ? spec.factorFor(l.input) * plantF(l.input) : 1;
        const qty = r6((q === null ? l.qty : q) * f);
        const rate = inputPrice(p, input);
        const specNote = spec && spec.lineNote ? (spec.lineNote[l.input] || spec.lineNote[input] || '') : '';
        return { input: input, label: inp.label, unit: inp.unit, qty: qty, rate: rate,
                 note: specNote || l.note || '', spec: f !== 1 || !!swapped, amount: r2(qty * rate) };
      });
      labour = (r.labour || []).map(w => {
        const inp = byId(w.input) || { label: w.input, unit: '' };
        const q = qtyOf(p, e.key, w.input + ':lab');
        const days = r6((q === null ? w.days : q) * depthF);
        const rate = inputPrice(p, w.input);
        return { input: w.input, label: inp.label, unit: inp.unit, qty: days, rate: rate,
                 note: depthF !== 1 ? days.toFixed(3) + ' days for ' + (spec ? spec.depthNow : '') + ' m depth' : '',
                 spec: depthF !== 1, amount: r2(days * rate) };
      });
      fixed = (r.fixed || []).map(f => ({ id: f.id, label: f.label,
        amount: r2(fixedAmount(p, e.key, f, e) * (f.id === 'plant' ? depthF : 1)) }));
      oh = overheads(p, e.key, r.oh);
    } else {
      assessed = true;
      const ohDef = 15;
      const s = shares(e.unit, ohDef);
      const base = baseRate(p, e);
      fixed = [
        { id: 'materials', label: 'Materials and components (supply)', amount: r2(fixedAmount(p, e.key, { id: 'materials', amount: () => base * s.mat / 100 }, e)) },
        { id: 'labour', label: 'Labour and plant (fix only)', amount: r2(fixedAmount(p, e.key, { id: 'labour', amount: () => base * s.lab / 100 }, e)) }
      ];
      oh = overheads(p, e.key, s.oh);
    }

    const subtotal = r2(lines.concat(labour).reduce((s, x) => s + x.amount, 0) +
      fixed.reduce((s, x) => s + x.amount, 0));
    const upliftAmt = r2(subtotal * oh / 100);
    const computed = r2(subtotal + upliftAmt);
    return { key: e.key, title: r ? r.title : e.desc, unit: e.unit, lines: lines, labour: labour,
             fixed: fixed, subtotal: subtotal, overheads: oh, uplift: upliftAmt, computed: computed,
             assessed: assessed, entry: e, spec: (spec && spec.changed) ? spec : null,
             adopted: !!(p && p.rb && p.rb.adopted && p.rb.adopted[e.key]) };
  }

  /* ----------------------------------------------------------------
     ADOPTION — write the computed cost into the bill's rate table
     ---------------------------------------------------------------- */
  /* remember the rate the bill carried before it was first adopted, so that
     "use bill rates" can put back exactly what was there */
  function remember(p, key, e) {
    p.rb = p.rb || {};
    p.rb.orig = p.rb.orig || {};
    if (key in p.rb.orig) return;
    if (key.indexOf('door:') === 0 || key.indexOf('window:') === 0) {
      const kind = key.slice(0, key.indexOf(':'));
      const ref = key.slice(key.indexOf(':') + 1);
      const arr = kind === 'door' ? (p.doors || []) : (p.windows || []);
      const it = arr.find(x => x.ref === ref);
      const v = it ? it.rate : null;
      p.rb.orig[key] = { base: v, all: v };
    } else {
      p.rb.orig[key] = {
        base: (p.rates && p.rates[key] !== undefined) ? p.rates[key] : null,
        all: e ? e.rate : null
      };
    }
  }

  function writeRate(p, key, computed, e, f) {
    const v = r2(computed / f);
    remember(p, key, e);
    if (key.indexOf('door:') === 0 || key.indexOf('window:') === 0) {
      const kind = key.slice(0, key.indexOf(':'));
      const ref = key.slice(key.indexOf(':') + 1);
      const arr = kind === 'door' ? (p.doors || []) : (p.windows || []);
      const it = arr.find(x => x.ref === ref);
      if (it) it.rate = v;
      return;
    }
    p.rates = p.rates || {};
    p.rates[key] = v;
  }

  function apply(p, result) {
    if (!p) return p;
    const ad = (p.rb && p.rb.adopted) || {};
    const entries = list(result);
    const f = uplift(p);
    entries.forEach(e => {
      if (!ad[e.key]) return;
      const c = compute(p, e);
      if (c) writeRate(p, e.key, c.computed, e, f);
    });
    return p;
  }

  function adopt(p, key, on) {
    p.rb = p.rb || {};
    p.rb.adopted = p.rb.adopted || {};
    p.rb.adopted[key] = !!on;
    return p;
  }

  function adoptedCount(p) {
    const ad = (p && p.rb && p.rb.adopted) || {};
    return Object.keys(ad).filter(k => ad[k]).length;
  }

  /* put back exactly the rate the bill carried before any adoption */
  function restore(p) {
    const rb = p && p.rb;
    const orig = (rb && rb.orig) || {};
    Object.keys(orig).forEach(k => {
      const o = orig[k];
      const v = (o && typeof o === 'object') ? o.base : null;
      if (k.indexOf('door:') === 0 || k.indexOf('window:') === 0) {
        const i = k.indexOf(':');
        const kind = k.slice(0, i), ref = k.slice(i + 1);
        const arr = kind === 'door' ? (p.doors || []) : (p.windows || []);
        const it = arr.find(x => x.ref === ref);
        if (it && v != null) it.rate = v;
        return;
      }
      if (!p.rates) return;
      if (v == null) delete p.rates[k];
      else p.rates[k] = v;
    });
  }

  function reset(p) {
    if (!p) return p;
    restore(p);
    delete p.rb;
    return p;
  }

  function useBill(p) {
    if (!p) return p;
    restore(p);
    p.rb = p.rb || {};
    p.rb.adopted = {};
    p.rb.orig = {};
    return p;
  }

  /* ----------------------------------------------------------------
     A RATE THAT FOLLOWS ITS DESCRIPTION
     The rate a row carries is scaled by what the description does to
     the build-up: same specification, same rate; a richer mix, a
     thicker coat, a deeper trench — a proportionally different rate.
     A rate typed on the row always wins over this.
     ---------------------------------------------------------------- */
  function rateFromDesc(p, key, desc, unit, rate) {
    if (!recipe(key)) return null;
    const base = Number(rate);
    if (!isFinite(base) || base <= 0) return null;
    const e = { key: key, unit: unit || 'm2', desc: desc || '', rate: base };
    const cNew = compute(p, e);
    const cBase = compute(p, Object.assign({}, e, { desc: '' }));
    if (!cNew || !cBase || !(cBase.computed > 0)) return null;
    const v = r2(base * cNew.computed / cBase.computed);
    return { rate: v, base: base, spec: cNew.spec, note: cNew.spec ? cNew.spec.note : '',
             changed: !!(cNew.spec && cNew.spec.changed) };
  }

  root.RateBuild = {
    BLOCKS_PER_M2: BLOCKS_PER_M2,
    INPUTS, RECIPES, SPECS, byId, recipe, list, compute, apply, adopt, adoptedCount,
    reset, useBill, restore, inputPrice, overheads, uplift, shares,
    parseSpec, specUse, rateFromDesc
  };
})(typeof window !== 'undefined' ? window : globalThis);
