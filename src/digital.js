/* Quick Quantity — the digital take-off engine
   Measure straight off the plan: lines and polylines for linear work, polygons
   for areas, points for counts and boxes for volumes. Every mark is kept in
   image pixels, so zooming or re-fitting the drawing never changes a number;
   the scale is applied once, when the mark is measured. */
(function (root) {
  'use strict';

  const GROUPS = [
    {
      id: 'linear', name: 'Linear', unit: 'm', tool: 'line', hue: '#1c6b4f',
      blurb: 'Run a line along the work — walls, beams, fencing, pipes, cables, roads.',
      cats: [
        { id: 'wall', name: 'Walls' }, { id: 'beam', name: 'Beams' },
        { id: 'fence', name: 'Fencing' }, { id: 'pipe', name: 'Pipes' },
        { id: 'cable', name: 'Cables' }, { id: 'road', name: 'Roads' }
      ]
    },
    {
      id: 'area', name: 'Area', unit: 'm2', tool: 'polygon', hue: '#7650b5',
      blurb: 'Trace round a surface — floor finishes, roofing, painting, tiling, landscaping.',
      cats: [
        { id: 'floor', name: 'Floor finishes', waste: 5 }, { id: 'roof', name: 'Roofing', waste: 10 },
        { id: 'paint', name: 'Painting', waste: 5 }, { id: 'tile', name: 'Tiling', waste: 10 },
        { id: 'landscape', name: 'Landscaping', waste: 5 }
      ]
    },
    {
      id: 'count', name: 'Count', unit: 'nr', tool: 'point', hue: '#b26a0f',
      blurb: 'Click each one — doors, windows, light fixtures, outlets, columns, toilets.',
      cats: [
        { id: 'door', name: 'Doors' }, { id: 'window', name: 'Windows' },
        { id: 'light', name: 'Light fixtures' }, { id: 'outlet', name: 'Power outlets' },
        { id: 'column', name: 'Columns' }, { id: 'toilet', name: 'Toilets' }
      ]
    },
    {
      id: 'volume', name: 'Volume', unit: 'm3', tool: 'box', hue: '#22577a',
      blurb: 'Box the footprint and give it a depth — concrete, excavation, fill, asphalt.',
      cats: [
        { id: 'concrete', name: 'Concrete' }, { id: 'excavation', name: 'Excavation' },
        { id: 'fill', name: 'Fill materials' }, { id: 'asphalt', name: 'Asphalt' }
      ]
    }
  ];

  const TOOLS = [
    { id: 'line', name: 'Line', group: 'linear', hint: 'Click two points — the length is read as you go.' },
    { id: 'polyline', name: 'Polyline', group: 'linear', hint: 'Click each corner; double-click or Finish to end.' },
    { id: 'polygon', name: 'Polygon', group: 'area', hint: 'Click round the surface; double-click or Finish to close it.' },
    { id: 'box', name: 'Box', group: 'volume', hint: 'Drag a rectangle round the footprint, then set the depth.' },
    { id: 'point', name: 'Point', group: 'count', hint: 'Click each item — the count follows automatically.' }
  ];

  const PAPERS = [[420, 'A3'], [594, 'A2'], [841, 'A1'], [1189, 'A0'], [297, 'A4']];
  const ARCH = [20, 25, 50, 100, 200, 500];
  const ENG = [100, 200, 250, 500, 1000, 1250, 2500];
  const METRIC = [1, 5, 10, 20, 50, 100];

  /* which bill items a measured category is allowed to land on */
  /* Which bill items a measured category may land on, strongest word first.
     The first item in the bill that carries the highest-priority word wins —
     so "Walls" finds the blockwork, not the cornice that mentions a wall. */
  /* Which bill item a measured quantity belongs on. `words` run from the most
     specific reading of the category to the loosest; `avoid` keeps a loose word
     from dragging in the wrong trade — a wall measured in metres must never
     land on the cornice that runs along the top of it. */
  const MATCH = {
    wall: { unit: 'm', avoid: /cornice|skirting|dado|architrave|bead|cill|sill|junction|fascia|barge|purlin|ridge|gutter|downpipe|trim|hoarding|plinth|balustrade/i,
            words: [/blockwork|block work|sandcrete|masonry|brickwork/i, /\bwalls?\b/i] },
    beam: { unit: 'm', avoid: /slab|column/i, words: [/ring beam|tie beam|ground beam|\bbeams?\b/i, /lintel/i] },
    fence: { unit: 'm', avoid: /cornice|skirting|junction/i, words: [/boundary|fence|hoarding/i, /\bwalls?\b/i] },
    pipe: { unit: 'm', avoid: /conduit|cable/i, words: [/soil|waste pipe|plumbing|pipework|\bpipes?\b/i, /drain/i] },
    cable: { unit: 'm', avoid: /pipe/i, words: [/conduit|wiring|cable|trunking/i, /\bearth\b/i] },
    road: { unit: 'm', avoid: /kerb|channel/i, words: [/road|driveway|carriageway|access road/i, /kerb/i] },
    floor: { unit: 'm2', avoid: /ceiling|wall|roof|skirting|cornice/i,
             words: [/floor screed|screed|floor finish|floor slab|floor tiles|\bfloors?\b/i, /terrazzo|granolithic|topping/i] },
    roof: { unit: 'm2', avoid: /floor|ceiling|wall/i, words: [/roof covering|roofing sheet|long-span|roof sheeting|\broof/i, /eaves|rafters/i] },
    paint: { unit: 'm2', avoid: /skirting|cornice|door|frame/i, words: [/emulsion|gloss|\bpaint/i, /decorat|primer|undercoat/i] },
    tile: { unit: 'm2', avoid: /floor|wall/i, words: [/\btiles?\b|tiling|ceramic|porcelain/i, /mosaic/i] },
    landscape: { unit: 'm2', avoid: /floor|roof/i, words: [/landscap|apron|paving|lawn|grass|soft landscaping/i, /kerb|edging/i] },
    door: { unit: 'nr', avoid: /window|louvre|ironmongery|furniture/i, words: [/\bdoors?\b|doorway|door leaf/i] },
    window: { unit: 'nr', avoid: /door(?!.*window)/i, words: [/\bwindows?\b|glazing|louvre|casement/i] },
    light: { unit: 'nr', avoid: /socket|switch/i, words: [/light fitting|lighting|\blights?\b|luminaire/i] },
    outlet: { unit: 'nr', avoid: /light/i, words: [/socket|outlet|power point|switch/i] },
    column: { unit: 'nr', avoid: /beam|base/i, words: [/\bcolumns?\b|stanchion|pillar/i] },
    toilet: { unit: 'nr', avoid: /light|socket/i, words: [/\bwc\b|water closet|toilet|sanitary|wash hand basin|basin/i] },
    concrete: { unit: 'm3', avoid: /excavat|fill|hardcore|backfill/i, words: [/\bconcrete\b|\bpcc\b|\brcc\b/i, /blinding/i] },
    excavation: { unit: 'm3', avoid: /concrete|fill|hardcore|backfill/i, words: [/\bexcavat/i, /trench|earthwork|\bdig\b/i] },
    fill: { unit: 'm3', avoid: /concrete|excavat/i, words: [/hardcore|backfill|\bfill(ing)?\b/i, /selected material/i] },
    asphalt: { unit: 'm3', avoid: /concrete/i, words: [/asphalt|bitumen|tarmac/i, /surfacing/i] }
  };

  /* Best bill item for a category, not merely the first one that happens to
     match. A strong word beats a loose one; among equals the more specific
     description wins, which nudges "150 mm sandcrete block walls" past the
     "balustrade wall" that only mentions walls in passing. */
  function matchItem(cid, bills) {
    const rule = MATCH[cid];
    if (!rule) return null;
    let best = null;
    (rule.words || []).forEach((re, rank) => {
      (bills || []).forEach(b => (b.items || []).forEach(it => {
        const desc = String(it.desc || '');
        if (normUnit(it.unit) !== rule.unit) return;
        if (rule.avoid && rule.avoid.test(desc)) return;
        if (!re.test(desc)) return;
        const score = (rule.words.length - rank) * 100 + Math.min(40, desc.length / 8) - (Number(it.qty) ? 0 : 5);
        if (!best || score > best.score) best = { bill: b, item: it, score };
      }));
    });
    return best;
  }



  /* bills say No., nr, Nos. — the take-off says nr; they must still meet */
  function normUnit(u) {
    u = String(u == null ? '' : u).toLowerCase().replace(/\./g, '').trim()
      .replace('²', '2').replace('³', '3');
    if (u === 'no' || u === 'nos' || u === 'nr' || u === 'number' || u === 'each') return 'nr';
    if (u === 'item') return 'item';
    return u;
  }

  const uid = () => 'dt' + Math.random().toString(36).slice(2, 9);
  const round = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function pathLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }
  function polyArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  }
  function bbox(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach(p => { if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0]; if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1]; });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  }

  const groupOf = id => GROUPS.filter(g => g.id === id)[0] || GROUPS[0];
  const catOf = (g, id) => groupOf(g).cats.filter(c => c.id === id)[0] || groupOf(g).cats[0];
  const unitOf = g => groupOf(g).unit;
  const nice = u => (u === 'm2' ? 'm²' : u === 'm3' ? 'm³' : u);

  /* how a mark is measured — the one place the numbers come from */
  function measure(mark) {
    const s = (+mark.mmPerPx || 0) / 1000;                 // metres per pixel
    const out = { qty: 0, unit: unitOf(mark.group), len: null, area: null, perim: null, vol: null };
    if (!s || !mark.pts || !mark.pts.length) return out;
    if (mark.kind === 'line' || mark.kind === 'polyline') {
      out.len = pathLen(mark.pts) * s;
      out.qty = out.len;
    } else if (mark.kind === 'polygon') {
      out.area = polyArea(mark.pts) * s * s;
      out.perim = pathLen(mark.pts.concat([mark.pts[0]])) * s;
      out.waste = +mark.waste || 0;
      out.qty = out.area * (1 + out.waste / 100);
    } else if (mark.kind === 'box') {
      const b = bbox(mark.pts);
      out.area = Math.abs(b.w * b.h) * s * s;
      const depth = (+mark.depthMM || 0) / 1000;
      out.vol = out.area * depth;
      out.qty = out.vol;
      out.depth = depth;
      out.cut = !!mark.cut;
    } else if (mark.kind === 'point') {
      out.qty = 1;
    }
    return out;
  }

  /* the running totals, by group and by category */
  function totals(D) {
    const byCat = {}, byGroup = { linear: 0, area: 0, count: 0, volume: 0 };
    const cut = { cut: 0, fill: 0 };
    (D.marks || []).forEach(m => {
      const r = measure(m);
      if (m.kind === 'box') {
        const c = m.cut === true ? 'cut' : m.cut === false ? 'fill' : m.cut;
        if (c === 'cut') cut.cut += r.qty; else if (c === 'fill') cut.fill += r.qty;
      }
      byCat[m.cat] = byCat[m.cat] || { qty: 0, unit: r.unit, n: 0, name: catOf(m.group, m.cat).name, group: m.group };
      byCat[m.cat].qty += r.qty;
      byCat[m.cat].n += 1;
      byGroup[m.group] += r.qty;
    });
    return { byCat, byGroup, cut };
  }

  function blank(state) {
    if (!state.digital || typeof state.digital !== 'object') {
      state.digital = { scales: [], active: null, marks: [], tool: 'line', group: 'linear', cat: 'wall', snap: true, zoom: 1, pan: false };
    }
    const D = state.digital;
    if (!Array.isArray(D.scales)) D.scales = [];
    if (!Array.isArray(D.marks)) D.marks = [];
    if (!D.tool) D.tool = 'line';
    if (!D.group) D.group = 'linear';
    if (!D.cat) D.cat = groupOf(D.group).cats[0].id;
    if (D.snap === undefined) D.snap = true;
    if (!D.zoom) D.zoom = 1;
    if (typeof D.pan !== 'boolean') D.pan = false;
    return D;
  }

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function fmt(n, d) {
    if (n == null || !isFinite(n)) return '—';
    return (+n).toLocaleString('en-GB', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  }

  /* ------------------------------------------------------------------ html */
  function html(state, api) {
    const D = blank(state);
    const a = state.analysis;
    if (!state.image || !a) {
      const reading = !!state.image;
      return `<section class="panel dt">
        <h2><span class="stepno">3 · </span>Digital take-off</h2>
        <p class="lede">Draw straight off the plan and the quantities are measured as you go. The take-off runs
        on the plan's pixels and on the scale you set.</p>
        <div class="dt-blank">
          <b>${reading ? 'Reading the plan…' : 'No plan yet'}</b>
          <span class="hint">${reading
            ? 'The drawing comes back as soon as its pixels have been read — a second, on a large sheet.'
            : 'Upload a picture or a PDF page of the drawing first, then come back here to measure it.'}</span>
          ${reading ? '' : '<button class="btn primary" data-step="1">Go to upload</button>'}
        </div></section>`;
    }
    const active = D.scales.filter(s => s.id === D.active)[0] || D.scales[0] || null;
    const g = groupOf(D.group);

    return `
<section class="panel dt">
  <h2><span class="stepno">3 · </span>Digital take-off</h2>
  <p class="lede">Measure anything the model leaves out. Pick a tool, draw on the plan, and the engine
  reads the length, area, count or volume against the scale. Marks are kept with the drawing, so they
  survive a reload and can be sent into the bill.</p>

  <div class="dt-bar">
    ${GROUPS.map(gr => `<button class="dt-tab${gr.id === D.group ? ' on' : ''}" data-dt-group="${gr.id}">
      ${gr.name}<span>${nice(gr.unit)}</span></button>`).join('')}
    <span class="dt-spacer"></span>
    <button class="btn sm${D.snap ? ' primary' : ''}" id="dt-snap" title="Snap to corners and wall intersections">Snap ${D.snap ? 'on' : 'off'}</button>
    <button class="btn sm${D.pan ? ' primary' : ''}" id="dt-pan" title="Pan the drawing — or hold Space, or drag with the middle mouse button"><span class="dt-hand" aria-hidden="true">✥</span> Pan</button>
    <button class="btn sm" id="dt-zoom-out" title="Zoom out">−</button>
    <span class="dt-zoom" id="dt-zoom">${Math.round(D.zoom * 100)}%</span>
    <button class="btn sm" id="dt-zoom-in" title="Zoom in">+</button>
    <button class="btn sm" id="dt-zoom-fit" title="Fit the whole sheet in the window">Fit</button>
  </div>

  <div class="dt-tools">
    ${TOOLS.map(t => `<button class="dt-tool${t.id === D.tool ? ' on' : ''}" data-dt-tool="${t.id}">
      <b>${t.name}</b></button>`).join('')}
    <span class="dt-hint" id="dt-hint">${esc(TOOLS.filter(t => t.id === D.tool)[0].hint)}</span>
  </div>

  <div class="dt-cats">
    ${g.cats.map(c => `<button class="dt-cat${c.id === D.cat ? ' on' : ''}" data-dt-cat="${c.id}">
      ${c.name}${c.waste ? `<em>+${c.waste}%</em>` : ''}</button>`).join('')}
    <span class="dt-spacer"></span>
    ${D.group === 'count' ? '<button class="btn sm" id="dt-pick-sym" title="Drag a box round one symbol and the engine finds the others">Find repeats…</button>' : ''}
    <span class="dt-live" id="dt-live">${active ? 'Scale ' + esc(active.name) : 'No scale set — measure a known length'}</span>
  </div>

  <div class="dt-main">
    <div>
    <p class="dt-pan-note hint">Pan with the <b>Pan</b> button, hold <b>Space</b>, or drag with the
      middle mouse button. <b>Ctrl</b> + wheel zooms where the pointer is · <b>H</b> picks the hand.</p>
    <div class="dt-viewport${D.pan ? ' dt-pan' : ''}" id="dt-viewport">
      <div class="dt-canvas" id="dt-canvas" style="width:${Math.round(D.zoom * 100)}%">
        <img id="dt-img" src="${state.image.dataUrl}" alt="Plan for take-off" draggable="false">
        <svg id="dt-svg" viewBox="0 0 ${a.width} ${a.height}" preserveAspectRatio="none" aria-label="Take-off drawing"></svg>
      </div>
    </div>
    </div>

    <div class="dt-totals-bar">
      <h4>Running totals</h4>
      <div id="dt-totals">${totalsHtml(state, D)}</div>
    </div>

    <div class="dt-scales-card">
      <h4>Scale for new measurements</h4>
      <div id="dt-scale-box">${scaleBox(state, D, active)}</div>
    </div>
  </div>

  <div class="dt-sheet">
    <div class="dt-sheet-head">
      <h3>Take-off sheet <span class="dt-count" id="dt-count">${D.marks.length}</span></h3>
      <span class="dt-spacer"></span>
      <button class="btn sm" id="dt-undraft" hidden>Cancel the line</button>
      <button class="btn sm" id="dt-finish" hidden>Finish</button>
      <button class="btn sm danger" id="dt-clear">Clear all</button>
    </div>
    <div id="dt-table">${tableHtml(state, D)}</div>
    <div id="dt-apply">${applyHtml(state, D, api)}</div>
  </div>
</section>`;
  }

  function scaleBox(state, D, active) {
    const a = state.analysis;
    const kind = D._k || 'arch';
    const list = kind === 'eng' ? ENG : (kind === 'metric' ? METRIC : ARCH);
    const ratio = D._r && list.indexOf(+D._r) >= 0 ? +D._r : list[0];
    const paper = +D._p || 420;
    return `
    <div class="dt-sc-col">
    ${D.scales.length ? `<div class="dt-scales">${D.scales.map(s => `
      <label class="dt-scale${s.id === (active && active.id) ? ' on' : ''}">
        <input type="radio" name="dt-scale" value="${s.id}"${s.id === (active && active.id) ? ' checked' : ''}>
        <span><b>${esc(s.name)}</b><em>${fmt(s.mmPerPx, 3)} mm/px${s.kind === 'custom' ? ' · measured' : ''}</em></span>
        <button type="button" class="dt-x" data-dt-scale-del="${s.id}" title="Remove this scale">✕</button>
      </label>`).join('')}</div>` : '<p class="hint">No scale yet — set one below, or measure a known length on the plan.</p>'}

    </div>

    <div class="dt-sc-col">
    <div class="dt-cal">
      <div class="dt-cal-row">
        <select id="dt-kind" aria-label="Scale type">
          <option value="arch"${kind === 'arch' ? ' selected' : ''}>Architectural</option>
          <option value="eng"${kind === 'eng' ? ' selected' : ''}>Engineering</option>
          <option value="metric"${kind === 'metric' ? ' selected' : ''}>Metric</option>
          <option value="custom"${kind === 'custom' ? ' selected' : ''}>Custom / measured</option>
        </select>
        ${kind === 'custom' ? '' : `<select id="dt-ratio" aria-label="Scale ratio">${list.map(r => `<option value="${r}"${r === ratio ? ' selected' : ''}>1:${r}</option>`).join('')}</select>
        <select id="dt-paper" aria-label="Sheet size">${PAPERS.map(p => `<option value="${p[0]}"${p[0] === paper ? ' selected' : ''}>${p[1]}</option>`).join('')}</select>`}
      </div>
      ${kind === 'custom'
        ? ''
        : `<button class="btn sm primary" id="dt-add-scale">Add 1:${ratio} ${paperName(paper)}</button>
           <span class="hint">The sheet is taken as ${paperName(paper)} across the drawing.</span>`}
      <button class="btn sm${kind === 'custom' ? ' primary' : ''}" id="dt-calibrate" style="margin-top:6px">${D._cal ? 'Click two points on the plan…' : 'Measure a known length (2 clicks)'}</button>
      <span class="hint">The surest way: measure a dimension you know, then type its real length.</span>
    </div>
    ${D._cal && D._cal.pts && D._cal.pts.length === 2 ? `<div class="dt-cal-mm">
      <label>That length is</label>
      <input type="number" id="dt-cal-mm" min="1" step="10" placeholder="4500" value="">
      <span class="hint">mm</span>
      <button class="btn sm primary" id="dt-cal-set">Set</button>
      <button class="btn sm" id="dt-cal-cancel">Cancel</button>
    </div>` : ''}
    </div>

    <div class="dt-sc-col">
      <p class="hint">More than one scale can be live at once — every mark remembers the scale it was
      measured at. <a href="#" id="dt-recalc">Re-measure every mark at the selected scale</a>.</p>
      <p class="hint">A ratio scale reads the sheet as the paper size chosen; measuring a known length on the
      plan is the surest reading of all.</p>
    </div>`;
  }

  function paperName(mm) {
    const p = PAPERS.filter(x => x[0] === +mm)[0];
    return p ? p[1] : 'this sheet';
  }

  function tableHtml(state, D) {
    if (!D.marks.length) {
      return `<p class="dt-empty">Nothing measured yet. Pick a tool above and draw on the plan —
      a line for lengths, a polygon for areas, points for counts, a box for volumes.</p>`;
    }
    const rows = D.marks.map((m, i) => {
      const r = measure(m);
      const g = groupOf(m.group);
      let cells = '';
      if (m.kind === 'line' || m.kind === 'polyline') {
        cells = `<td class="num">${fmt(r.len)} m</td><td class="num">—</td><td class="num"><b>${fmt(r.qty)}</b> m</td>`;
      } else if (m.kind === 'polygon') {
        cells = `<td class="num">${fmt(r.area)} m²</td><td class="num">${r.waste ? '+' + r.waste + '%' : '—'}</td>
                 <td class="num"><b>${fmt(r.qty)}</b> m²</td>`;
      } else if (m.kind === 'box') {
        const c = m.cut === true ? 'cut' : m.cut === false ? 'fill' : m.cut;
        cells = `<td class="num">${fmt(r.area)} m² × ${fmt(r.depth)} m</td>
                 <td class="num">${c === 'cut' ? 'cut' : c === 'fill' ? 'fill' : '—'}</td>
                 <td class="num"><b>${fmt(r.qty)}</b> m³</td>`;
      } else {
        cells = `<td class="num">1 nr</td><td class="num">—</td><td class="num"><b>1</b> nr</td>`;
      }
      return `<tr class="dt-row" data-dt-mark="${m.id}">
        <td class="dt-no">${i + 1}</td>
        <td><span class="dt-dot" style="background:${g.hue}"></span>${esc(catOf(m.group, m.cat).name)}</td>
        <td class="dt-desc"><input data-dt-label="${m.id}" value="${esc(m.label || '')}" placeholder="Description (optional)"></td>
        ${cells}
        <td class="dt-act"><button class="mat-ib del" data-dt-del="${m.id}" title="Delete">✕</button></td>
      </tr>`;
    }).join('');
    return `<table class="dt-table">
      <thead><tr><th>#</th><th>Item</th><th>Description</th><th>Measured</th><th>Waste / depth</th><th>Quantity</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function totalsHtml(state, D) {
    const t = totals(D);
    const gs = GROUPS.filter(g => t.byGroup[g.id] > 0);
    if (!gs.length) return `<p class="hint">No quantities yet.</p>`;
    const cats = Object.keys(t.byCat).filter(k => t.byCat[k].qty > 0);
    return `${gs.map(g => `<div class="dt-tot"><span>${g.name}</span><b>${fmt(t.byGroup[g.id])} ${nice(g.unit)}</b></div>`).join('')}
      ${t.cut.cut || t.cut.fill ? `<div class="dt-tot"><span>Cut / fill</span><b>${fmt(t.cut.cut)} cut · ${fmt(t.cut.fill)} fill m³</b></div>` : ''}
      <div class="divider"></div>
      ${cats.map(k => `<div class="dt-tot sm"><span>${esc(t.byCat[k].name)} <em>×${t.byCat[k].n}</em></span><b>${fmt(t.byCat[k].qty)} ${nice(t.byCat[k].unit)}</b></div>`).join('')}`;
  }

  function applyHtml(state, D, api) {
    const t = totals(D);
    const r = api.result();
    const rows = [];
    Object.keys(t.byCat).forEach(cid => {
      const c = t.byCat[cid];
      if (!(c.qty > 0)) return;
      const rule = MATCH[cid];
      if (!rule || rule.unit !== c.unit) return;
      const best = matchItem(cid, r.bills);
      const opts = [];
      (r.bills || []).forEach(b => (b.items || []).forEach(it => {
        if (normUnit(it.unit) !== rule.unit) return;
        opts.push({ bill: b, item: it });
      }));
      if (best || opts.length) rows.push({ cid, c, best, opts });
    });
    if (!rows.length) {
      return `<p class="hint" style="margin-top:14px">When a measured item matches a bill item by unit and
      description, it can be sent straight into the take-off. None match yet — the wording of the bill and
      the item you measured have to line up.</p>`;
    }
    return `<div class="dt-apply">
      <h4>Send into the bill</h4>
      <p class="hint">Each measured quantity is offered against the bill items measured in the same unit,
      with the closest wording picked for you. Change the item from the list if you know better. Ticking one
      writes the quantity onto that item; its rate and description are left alone.</p>
      ${rows.map(x => {
        /* no confident wording match: offer the list, but do not pretend one
           of them is right. Nothing is sent until the user chooses. */
        const pick = x.best;
        const idx = pick ? Math.max(0, x.opts.findIndex(o => o.item === pick.item && o.bill.code === pick.bill.code)) : -1;
        return `<label class="dt-map">
        <input type="checkbox" data-dt-map="${x.cid}"${pick ? ' checked' : ' disabled'}>
        <span><b>${esc(t.byCat[x.cid].name)} ${fmt(x.c.qty)} ${nice(x.c.unit)}</b>
        <select data-dt-target="${x.cid}" data-dt-key="${pick ? esc(pick.bill.code) + '|' + esc(pick.item.key || String(pick.item.desc).slice(0, 28)) : ''}">
          ${pick ? '' : '<option value="-1" selected>— pick the bill item —</option>'}
          ${x.opts.map((o, i) => `<option value="${i}"${i === idx ? ' selected' : ''} data-key="${esc(o.bill.code)}|${esc(o.item.key || String(o.item.desc).slice(0, 28))}">${esc(o.bill.code)} · ${esc(String(o.item.desc).slice(0, 58))} (${fmt(o.item.qty)} ${esc(o.item.unit)})</option>`).join('')}
        </select></span>
      </label>`;
      }).join('')}
      <button class="btn primary" id="dt-send">Send to the bill</button>
    </div>`;
  }

  /* ----------------------------------------------------------------- mount */
  function mount(host, api) {
    const st = api.state, D = blank(st), a = st.analysis;
    const svg = host.querySelector('#dt-svg');
    const img = host.querySelector('#dt-img');
    const canvas = host.querySelector('#dt-canvas');
    const viewport = host.querySelector('#dt-viewport');
    if (!svg || !a) return;

    const W = a.width, H = a.height;
    let draft = null;             // the mark being drawn
    let cursor = null;            // last pointer position, image px
    let snapAt = null;            // the point we would snap to
    let dragFrom = null;          // box drag start
    let dragging = false;
    let panning = null;           // {id, x, y, left, top} while the hand is down
    let spaceDown = false;

    const scaleK = () => W / Math.max(1, svg.getBoundingClientRect().width);

    function toImage(ev) {
      const r = svg.getBoundingClientRect();
      return [(ev.clientX - r.left) * W / r.width, (ev.clientY - r.top) * H / r.height];
    }

    /* ---------------------------------------------------------- snapping */
    function snapCandidates() {
      const out = [];
      D.marks.forEach(m => (m.pts || []).forEach(p => out.push(p)));
      const an = st.analysis;
      if (an && an.hStrong && an.vStrong) {
        an.hStrong.slice(0, 14).forEach(h => an.vStrong.slice(0, 14).forEach(v => {
          out.push([v.pos, h.pos]);
        }));
      }
      out.push([0, 0], [W, 0], [0, H], [W, H]);
      return out;
    }
    function snap(p) {
      if (!D.snap) return { p: p, hit: null };
      const k = Math.max(1, scaleK());
      const th = 12 * k;
      let best = null, bd = th;
      snapCandidates().forEach(c => {
        const d = dist(p, c);
        if (d < bd) { bd = d; best = c; }
      });
      return best ? { p: best, hit: best } : { p: p, hit: null };
    }

    /* ----------------------------------------------------------- drawing */
    const k = () => Math.max(1, scaleK());
    const labelSize = () => 12 * k();

    function shape(m, i) {
      const g = groupOf(m.group);
      const col = g.hue;
      const pts = m.pts || [];
      const sw = 2 * k();
      let body = '';
      if (m.kind === 'point') {
        const r = 7 * k();
        body = `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="${r}" fill="${col}" fill-opacity=".85" stroke="#fff" stroke-width="${1.6 * k()}"/>
                <text x="${pts[0][0] + r + 3 * k()}" y="${pts[0][1] - r}" font-size="${labelSize()}" fill="${col}" font-weight="600">${esc(m.label || catOf(m.group, m.cat).name)}</text>`;
        return body;
      }
      const d = pts.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      if (m.kind === 'polygon') {
        body = `<path d="${d} Z" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="${sw}"/>`;
      } else if (m.kind === 'box') {
        const b = bbox(pts);
        body = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="${sw}"/>`;
      } else {
        body = `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      const vs = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${3 * k()}" fill="#fff" stroke="${col}" stroke-width="${1.4 * k()}"/>`).join('');
      const r = measure(m);
      const txt = m.kind === 'polygon' ? fmt(r.qty) + ' m²' : (m.kind === 'box' ? fmt(r.qty) + ' m³' : fmt(r.qty) + ' m');
      const c = bbox(pts);
      const pad = 5 * k(), fs = labelSize();
      const label = (m.label || catOf(m.group, m.cat).name) + ' · ' + txt;
      const ly = c.y - 6 * k();
      const lw = label.length * fs * 0.56 + pad * 2;
      return `${body}${vs}
        <g class="dt-label">
          <rect x="${c.cx - lw / 2}" y="${ly - fs - pad}" width="${lw}" height="${fs + pad * 1.4}" rx="${4 * k()}" fill="#fff" fill-opacity=".92" stroke="${col}" stroke-opacity=".35" stroke-width="${1 * k()}"/>
          <text x="${c.cx}" y="${ly - pad * 0.35}" font-size="${fs}" fill="${col}" text-anchor="middle" font-weight="600">${esc(label)}</text>
        </g>`;
    }

    function draftShape() {
      if (!draft || !draft.pts.length) return '';
      const col = groupOf(draft.group).hue;
      const sw = 2 * k();
      let pts = draft.pts.slice();
      if (cursor && draft.tool !== 'point') pts = pts.concat([cursor]);
      if (!pts.length) return '';
      const d = pts.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const closed = draft.tool === 'polygon' && pts.length > 2;
      let body = `<path d="${d}${closed ? ' Z' : ''}" fill="${closed ? col : 'none'}" fill-opacity=".1" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${6 * k()} ${4 * k()}"/>`;
      if (draft.tool === 'box' && pts.length >= 2) {
        const b = bbox(pts);
        body = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${col}" fill-opacity=".1" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${6 * k()} ${4 * k()}"/>`;
      }
      const vs = draft.pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${4 * k()}" fill="${col}" stroke="#fff" stroke-width="${1.5 * k()}"/>`).join('');
      return body + vs;
    }

    function paintHint() {
      const el = host.querySelector('#dt-hint');
      if (!el) return;
      const t = TOOLS.filter(x => x.id === D.tool)[0];
      el.textContent = D.pan
        ? 'Hand is on — drag to move the sheet. Press H, Space or the Pan button to draw again.'
        : (t ? t.hint : '');
    }

    function paint() {
      const parts = D.marks.map((m, i) => `<g class="dt-mark" data-dt-select="${m.id}">${shape(m, i)}</g>`).join('');
      const extra = draftShape();
      const cal = D._cal && D._cal.pts && D._cal.pts.length
        ? `<g>${D._cal.pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${6 * k()}" fill="#fff" stroke="#e8a33d" stroke-width="${2.4 * k()}"/>`).join('')}
           ${D._cal.pts.length > 1 ? `<line x1="${D._cal.pts[0][0]}" y1="${D._cal.pts[0][1]}" x2="${D._cal.pts[1][0]}" y2="${D._cal.pts[1][1]}" stroke="#e8a33d" stroke-width="${2 * k()}" stroke-dasharray="${5 * k()} ${4 * k()}"/>` : ''}</g>`
        : '';
      const snapDot = snapAt && cursor
        ? `<circle cx="${snapAt[0]}" cy="${snapAt[1]}" r="${9 * k()}" fill="none" stroke="#e8a33d" stroke-width="${2.4 * k()}"/>` : '';
      svg.innerHTML = parts + extra + cal + snapDot;
    }

    function liveText() {
      const el = host.querySelector('#dt-live');
      if (!el) return;
      if (draft && draft.pts.length && cursor) {
        const tmp = { group: draft.group, kind: draft.tool === 'polyline' ? 'polyline' : draft.tool === 'line' ? 'line' : draft.tool, pts: draft.pts.concat([cursor]), mmPerPx: scaleMM() };
        const r = measure(tmp);
        if (draft.tool === 'polygon' && tmp.pts.length > 2) {
          el.textContent = fmt(measure({ group: 'area', kind: 'polygon', pts: tmp.pts, mmPerPx: scaleMM() }).area) + ' m² · perimeter ' +
            fmt(measure({ group: 'area', kind: 'polygon', pts: tmp.pts, mmPerPx: scaleMM() }).perim) + ' m';
        } else if (draft.tool === 'box') {
          const b = bbox(tmp.pts);
          const rr = measure({ group: 'volume', kind: 'box', pts: tmp.pts, mmPerPx: scaleMM(), depthMM: 0 });
          el.textContent = fmt(rr.area) + ' m² footprint';
        } else {
          el.textContent = fmt(r.qty) + ' m';
        }
        return;
      }
      const act = activeScale();
      el.textContent = act ? 'Scale ' + act.name : 'No scale set — measure a known length';
    }

    /* a depth or a cut/fill flag changes one row; rebuilding the whole table
       under the focused input loses the keystroke, so only the figures move */
    function refreshFigures(m) {
      const r = measure(m);
      const row = host.querySelector(`[data-dt-mark="${m.id}"]`);
      if (row && row.children[5]) row.children[5].innerHTML = `<b>${fmt(r.qty)}</b> ${nice(r.unit)}`;
      host.querySelector('#dt-totals').innerHTML = totalsHtml(st, D);
      host.querySelector('#dt-apply').innerHTML = applyHtml(st, D, api);
      paint();
    }

    function paintTable() {
      host.querySelector('#dt-table').innerHTML = tableHtml(st, D);
      host.querySelector('#dt-count').textContent = D.marks.length;
      host.querySelector('#dt-totals').innerHTML = totalsHtml(st, D);
      host.querySelector('#dt-apply').innerHTML = applyHtml(st, D, api);
      host.querySelector('#dt-scale-box').innerHTML = scaleBox(st, D, activeScale());
      paint();
    }

    /* ------------------------------------------------------------- scale */
    function activeScale() {
      return D.scales.filter(s => s.id === D.active)[0] || D.scales[0] || null;
    }
    function scaleMM() {
      const s = activeScale();
      return s ? s.mmPerPx : 0;
    }

    function autoScale() {
      if (D.scales.length) return;
      const b = api.scaleBasis();
      if (!b || !b.mmPerPx) return;
      const label = b.known ? (b.printed ? '1:' + b.printed : 'From the drawing') : 'From the model size';
      const s = { id: uid(), name: label + ' · ' + fmt(b.mmPerPx, 3) + ' mm/px', kind: 'auto', mmPerPx: b.mmPerPx, note: b.basis };
      D.scales.push(s); D.active = s.id;
    }

    function addRatioScale() {
      const kind = host.querySelector('#dt-kind').value;
      const ratio = +host.querySelector('#dt-ratio').value;
      const paper = +host.querySelector('#dt-paper').value;
      const longPx = Math.max(W, H);
      const mmPerPx = paper * ratio / longPx;
      const name = '1:' + ratio + ' on ' + paperName(paper);
      const s = { id: uid(), name: name + ' · ' + fmt(mmPerPx, 3) + ' mm/px', kind: kind, ratio: ratio, paperMM: paper, mmPerPx: mmPerPx };
      D.scales.push(s); D.active = s.id;
      api.touch(); paintTable(); paintScaleChrome();
    }

    function paintScaleChrome() {
      host.querySelector('#dt-zoom').textContent = Math.round(D.zoom * 100) + '%';
      canvas.style.width = Math.round(D.zoom * 100) + '%';
      paintTable();
    }

    /* ------------------------------------------------------------- panning */
    function rememberScroll() {
      D.panX = viewport.scrollLeft; D.panY = viewport.scrollTop;
      clearTimeout(rememberScroll.t);
      rememberScroll.t = setTimeout(() => api.touch(), 400);
    }

    function beginPan(ev) {
      if (viewport.scrollWidth <= viewport.clientWidth + 1 && viewport.scrollHeight <= viewport.clientHeight + 1) {
        api.toast('The whole sheet already fits — zoom in to pan');
        return;
      }
      panning = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.classList.add('dt-grabbing');
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not fatal */ }
    }

    function endPan(ev) {
      if (!panning) return;
      panning = null;
      viewport.classList.remove('dt-grabbing');
      try { svg.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      rememberScroll();
    }

    /* zoom about a point on the screen, so what is under the pointer stays
       under the pointer — the difference between zooming and losing your place */
    function zoomAt(z, cx, cy) {
      z = Math.min(4, Math.max(0.5, Math.round(z * 100) / 100));
      if (z === D.zoom) return;
      const r0 = svg.getBoundingClientRect();
      const fx = r0.width ? (cx - r0.left) / r0.width : 0.5;
      const fy = r0.height ? (cy - r0.top) / r0.height : 0.5;
      D.zoom = z;
      paintScaleChrome();
      const r1 = svg.getBoundingClientRect();
      viewport.scrollLeft += (r1.left + fx * r1.width) - cx;
      viewport.scrollTop += (r1.top + fy * r1.height) - cy;
      rememberScroll();
      api.touch();
    }

    function zoomCentre(z) {
      const rv = viewport.getBoundingClientRect();
      zoomAt(z, rv.left + rv.width / 2, rv.top + rv.height / 2);
    }

    viewport.addEventListener('scroll', rememberScroll);
    viewport.addEventListener('wheel', ev => {
      if (!(ev.ctrlKey || ev.metaKey)) return;         // a plain wheel still scrolls
      ev.preventDefault();
      zoomAt(D.zoom + (ev.deltaY > 0 ? -0.25 : 0.25), ev.clientX, ev.clientY);
    }, { passive: false });

    /* ------------------------------------------------------------ commit */
    function commit(tool, pts) {
      const g = TOOLS.filter(t => t.id === tool)[0].group;
      const m = {
        id: uid(), kind: tool === 'polyline' ? 'polyline' : tool,
        group: g, cat: D.group === g ? D.cat : groupOf(g).cats[0].id,
        pts: pts, mmPerPx: scaleMM(), scaleId: (activeScale() || {}).id || null,
        label: '', waste: 0, depthMM: null, cut: false
      };
      if (g === 'area') {
        const c = catOf('area', m.cat);
        m.waste = c.waste || 0;
      }
      if (g === 'volume') { m.depthMM = 150; m.cut = ''; }
      if (!m.mmPerPx) { api.toast('Set a scale first — then the line has a length'); return; }
      D.marks.push(m);
      api.touch(); paintTable();
      if (g === 'volume') {
        /* the depth is asked for straight away, in the sheet */
        const row = host.querySelector(`[data-dt-mark="${m.id}"]`);
        if (row) row.classList.add('dt-fresh');
        api.toast('Box measured — set its depth in the take-off sheet');
      }
    }

    /* ---------------------------------------------------------- listeners */
    svg.addEventListener('pointermove', ev => {
      if (panning && panning.id === ev.pointerId) {
        viewport.scrollLeft = panning.left - (ev.clientX - panning.x);
        viewport.scrollTop = panning.top - (ev.clientY - panning.y);
        return;
      }
      const raw = toImage(ev);
      const s = snap(raw);
      cursor = raw; snapAt = s.hit;
      if (dragging && draft && draft.tool === 'box' && draft.pts.length === 1) {
        draft.pts[1] = s.p;
        cursor = s.p;
      } else if (draft) {
        cursor = s.p;
      }
      paint(); liveText();
    });

    svg.addEventListener('pointerdown', ev => {
      /* the hand wins over every tool: middle button, the Pan toggle, or Space */
      if (ev.button === 1 || D.pan || spaceDown) {
        if (ev.button === 1) ev.preventDefault();
        beginPan(ev);
        return;
      }
      if (ev.button !== 0) return;
      const raw = toImage(ev);
      const s = snap(raw);
      const p = s.p;
      cursor = p; snapAt = s.hit;

      /* calibrating: two clicks then a length in mm */
      if (D._cal) {
        D._cal.pts = (D._cal.pts || []).concat([p]);
        if (D._cal.pts.length >= 2) D._cal.pts = D._cal.pts.slice(0, 2);
        api.touch(); paint(); paintTable();
        if (D._cal.pts.length === 2) setTimeout(() => host.querySelector('#dt-cal-mm') && host.querySelector('#dt-cal-mm').focus(), 40);
        return;
      }

      /* a symbol to look for: drag a box round one */
      if (D._pick) {
        if (!dragFrom) { dragFrom = p; dragging = true; D._pickBox = null; }
        return;
      }

      if (!D.tool) return;
      if (D.tool === 'point') { commit('point', [p]); return; }

      if (!draft) {
        draft = { tool: D.tool, group: TOOLS.filter(t => t.id === D.tool)[0].group, pts: [p] };
        if (D.tool === 'box') { draft.pts = [p, p]; dragging = true; dragFrom = p; }
      } else {
        draft.pts.push(p);
        if (draft.tool === 'line') finishDraft();
      }
      paint(); liveText(); showDraftButtons();
    });

    svg.addEventListener('pointerup', ev => {
      if (panning && panning.id === ev.pointerId) { endPan(ev); return; }
      if (dragging && draft && draft.tool === 'box') {
        const p = snap(toImage(ev)).p;
        draft.pts[1] = p;
        dragging = false;
        if (dist(draft.pts[0], p) > 3) { finishDraft(); return; }
        draft = null; paint(); liveText(); showDraftButtons(); return;
      }
      if (dragging && D._pick) {
        dragging = false;
        const p = snap(toImage(ev)).p;
        const b = { x: Math.min(dragFrom[0], p[0]), y: Math.min(dragFrom[1], p[1]), w: Math.abs(p[0] - dragFrom[0]), h: Math.abs(p[1] - dragFrom[1]) };
        if (b.w > 6 && b.h > 6) pickSymbol(b);
        dragFrom = null;
      }
    });

    svg.addEventListener('pointercancel', ev => { if (panning) endPan(ev); });

    svg.addEventListener('dblclick', ev => {
      ev.preventDefault();
      if (draft && (draft.tool === 'polyline' || draft.tool === 'polygon')) finishDraft();
    });

    /* Enter closes a polyline or a polygon, Escape lets go of it. The keys are
       caught on the window so the user does not have to find the little button
       after clicking the last point. */
    function onKey(ev) {
      if (!document.body.contains(svg)) {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKeyUp);
        return;
      }
      const tag = (ev.target && ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (ev.code === 'Space' || ev.key === ' ') {
        /* hold Space to move the sheet about without putting the tool down */
        if (!spaceDown) { spaceDown = true; viewport.classList.add('dt-pan'); }
        ev.preventDefault();
        return;
      }
      if (ev.key === 'Enter' && draft && (draft.tool === 'polyline' || draft.tool === 'polygon')) {
        ev.preventDefault(); finishDraft();
      } else if (ev.key === 'Escape') {
        if (draft) { draft = null; paint(); liveText(); showDraftButtons(); }
        else if (D._cal) { D._cal = null; paint(); paintTable(); }
      } else if (ev.key === 'h' || ev.key === 'H') {
        D.pan = !D.pan;
        viewport.classList.toggle('dt-pan', D.pan);
        const b = host.querySelector('#dt-pan');
        if (b) b.classList.toggle('primary', D.pan);
        paintHint();
        api.touch();
      }
    }
    function onKeyUp(ev) {
      if (ev.code === 'Space' || ev.key === ' ') {
        spaceDown = false;
        if (!D.pan) viewport.classList.remove('dt-pan');
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);

    function finishDraft() {
      if (!draft) return;
      const pts = draft.pts.slice();
      const tool = draft.tool;
      draft = null; dragging = false; dragFrom = null;
      host.querySelector('#dt-finish').hidden = true;
      host.querySelector('#dt-undraft').hidden = true;
      if (tool === 'polyline' && pts.length < 2) { paint(); return; }
      if (tool === 'polygon' && pts.length < 3) { api.toast('A polygon needs at least three points'); paint(); return; }
      commit(tool, pts);
      paint(); liveText();
    }

    function showDraftButtons() {
      const many = draft && (draft.tool === 'polyline' || draft.tool === 'polygon');
      host.querySelector('#dt-finish').hidden = !many;
      host.querySelector('#dt-undraft').hidden = !draft;
    }

    host.addEventListener('click', ev => {
      const t = ev.target.closest('[data-dt-group],[data-dt-tool],[data-dt-cat],[data-dt-del],[data-dt-scale-del],#dt-snap,#dt-pan,#dt-zoom-in,#dt-zoom-out,#dt-zoom-fit,#dt-finish,#dt-undraft,#dt-clear,#dt-add-scale,#dt-calibrate,#dt-cal-set,#dt-cal-cancel,#dt-recalc,#dt-send,#dt-pick-sym,#dt-pick-yes,#dt-pick-no');
      if (!t) return;
      const tg = t.getAttribute('data-dt-group');
      const tt = t.getAttribute('data-dt-tool');
      const tc = t.getAttribute('data-dt-cat');
      const del = t.getAttribute('data-dt-del');
      const sdel = t.getAttribute('data-dt-scale-del');

      if (tg) {
        D.group = tg; D.cat = groupOf(tg).cats[0].id;
        D.tool = groupOf(tg).tool;
        api.rerender(); return;
      }
      if (tt) {
        D.tool = tt;
        const g = TOOLS.filter(x => x.id === tt)[0].group;
        if (D.group !== g) { D.group = g; D.cat = groupOf(g).cats[0].id; }
        api.rerender(); return;
      }
      if (tc) { D.cat = tc; api.rerender(); return; }
      if (del) {
        D.marks = D.marks.filter(m => m.id !== del);
        api.touch(); paintTable(); return;
      }
      if (sdel) {
        D.scales = D.scales.filter(s => s.id !== sdel);
        if (D.active === sdel) D.active = (D.scales[0] || {}).id || null;
        api.touch(); paintTable(); return;
      }
      switch (t.id) {
        case 'dt-snap': D.snap = !D.snap; api.touch(); t.classList.toggle('primary', D.snap); t.textContent = 'Snap ' + (D.snap ? 'on' : 'off'); break;
        case 'dt-zoom-in': zoomCentre(D.zoom + 0.25); break;
        case 'dt-zoom-out': zoomCentre(D.zoom - 0.25); break;
        case 'dt-zoom-fit': {
          /* fit means the whole sheet in the window, width and height */
          const rv = viewport.getBoundingClientRect();
          const h100 = img.getBoundingClientRect().height / (D.zoom || 1);
          const z = Math.min(1, (rv.height - 6) / Math.max(1, h100));
          D.zoom = Math.max(0.5, Math.min(1, Math.round(z * 100) / 100));
          paintScaleChrome();
          viewport.scrollLeft = 0; viewport.scrollTop = 0;
          D.panX = 0; D.panY = 0; api.touch();
          break;
        }
        case 'dt-pan':
          D.pan = !D.pan;
          viewport.classList.toggle('dt-pan', D.pan || spaceDown);
          t.classList.toggle('primary', D.pan);
          paintHint();
          api.touch();
          break;
        case 'dt-finish': finishDraft(); break;
        case 'dt-undraft': draft = null; dragging = false; host.querySelector('#dt-finish').hidden = true; host.querySelector('#dt-undraft').hidden = true; paint(); liveText(); break;
        case 'dt-clear':
          if (D.marks.length && api.confirm('Delete all ' + D.marks.length + ' take-off marks?')) {
            D.marks = []; api.touch(); paintTable();
          }
          break;
        case 'dt-add-scale': addRatioScale(); break;
        case 'dt-calibrate': D._cal = { pts: [] }; api.rerender(); break;
        case 'dt-cal-cancel': D._cal = null; api.rerender(); break;
        case 'dt-cal-set': {
          const mm = +host.querySelector('#dt-cal-mm').value;
          const pts = (D._cal && D._cal.pts) || [];
          if (!(mm > 0) || pts.length < 2) { api.toast('Type the real length in millimetres'); break; }
          const px = dist(pts[0], pts[1]);
          if (px < 3) { api.toast('Those two points are too close together'); break; }
          const s = { id: uid(), name: 'Measured ' + fmt(mm, 0) + ' mm over ' + Math.round(px) + ' px · ' + fmt(mm / px, 3) + ' mm/px',
            kind: 'custom', mmPerPx: mm / px, refPx: px, refMM: mm };
          D.scales.push(s); D.active = s.id; D._cal = null;
          api.touch(); api.rerender();
          break;
        }
        case 'dt-recalc': {
          const s = activeScale();
          if (!s) { api.toast('Set a scale first'); break; }
          if (!D.marks.length) { api.toast('There is nothing measured yet'); break; }
          if (!api.confirm('Re-measure all ' + D.marks.length + ' marks at ' + s.name + '?')) break;
          D.marks.forEach(m => { m.mmPerPx = s.mmPerPx; m.scaleId = s.id; });
          api.touch(); paintTable(); api.toast('Every mark re-measured at ' + s.name);
          break;
        }
        case 'dt-send': sendToBill(); break;
        case 'dt-pick-sym': startSymbolPick(); break;
        case 'dt-pick-no': D._cand = null; D._pick = false; api.rerender(); break;
        case 'dt-pick-yes': acceptCandidates(); break;
      }
    });

    host.addEventListener('change', ev => {
      const t = ev.target;
      if (t.name === 'dt-scale') { D.active = t.value; api.touch(); paintTable(); }
      else if (t.id === 'dt-kind') { D._k = t.value; D._r = null; api.rerender(); }
      else if (t.id === 'dt-ratio') { D._r = +t.value; D._k = host.querySelector('#dt-kind').value; api.rerender(); }
      else if (t.id === 'dt-paper') { D._p = +t.value; D._k = host.querySelector('#dt-kind').value; api.rerender(); }
      else if (t.hasAttribute && t.hasAttribute('data-dt-label')) {
        const id = t.getAttribute('data-dt-label');
        const m = D.marks.filter(x => x.id === id)[0];
        if (m) { m.label = t.value; api.touch(); paint(); liveText(); }
      } else if (t.hasAttribute && t.hasAttribute('data-dt-depth')) {
        const id = t.getAttribute('data-dt-depth');
        const m = D.marks.filter(x => x.id === id)[0];
        if (m) { m.depthMM = Math.max(0, +t.value || 0); api.touch(); refreshFigures(m); }
      }
    });

    /* depth / cut controls live next to the volume rows */
    function decorateRows() {
      D.marks.filter(m => m.kind === 'box').forEach(m => {
        const row = host.querySelector(`[data-dt-mark="${m.id}"]`);
        if (!row) return;
        const cell = row.children[4];
        if (!cell || cell.querySelector('.dt-depth')) return;
        cell.innerHTML = `<span class="dt-depth">
          <input type="number" min="0" step="25" value="${m.depthMM == null ? 150 : m.depthMM}" data-dt-depth="${m.id}"> mm
          <select data-dt-cut="${m.id}" title="Cut or fill">
            <option value=""${!m.cut ? ' selected' : ''}>—</option>
            <option value="cut"${m.cut === 'cut' || m.cut === true ? ' selected' : ''}>cut</option>
            <option value="fill"${m.cut === 'fill' || m.cut === false ? ' selected' : ''}>fill</option>
          </select>
        </span>`;
      });
    }

    /* the depth is typed, so it is followed keystroke by keystroke */
    host.addEventListener('input', ev => {
      const t = ev.target;
      const id = t.getAttribute && t.getAttribute('data-dt-depth');
      if (!id) return;
      const m = D.marks.filter(x => x.id === id)[0];
      if (!m) return;
      m.depthMM = Math.max(0, +t.value || 0);
      api.touch(); refreshFigures(m);
    });

    host.addEventListener('change', ev => {
      const tsel = ev.target.getAttribute && ev.target.getAttribute('data-dt-target');
      if (tsel) {
        const opt = ev.target.options[ev.target.selectedIndex];
        if (opt) ev.target.setAttribute('data-dt-key', opt.getAttribute('data-key') || '');
        const box = host.querySelector(`[data-dt-map="${tsel}"]`);
        if (box) {
          box.disabled = !ev.target.getAttribute('data-dt-key');
          box.checked = !!ev.target.getAttribute('data-dt-key');
        }
        return;
      }
      const c = ev.target.getAttribute && ev.target.getAttribute('data-dt-cut');
      if (!c) return;
      const m = D.marks.filter(x => x.id === c)[0];
      if (m) {
        m.cut = ev.target.value === 'cut' ? 'cut' : ev.target.value === 'fill' ? 'fill' : '';
        api.touch(); refreshFigures(m);
      }
    });

    /* ------------------------------------------------------------ symbols */
    function startSymbolPick() {
      D._pick = true; D._cand = null;
      api.rerender();
      api.toast('Drag a box round one example of the symbol');
    }

    function pickSymbol(box) {
      D._pick = false;
      const cat = D.cat;
      api.toast('Looking for marks the size of that symbol…');
      findRepeats(img, box, function (err, found) {
        if (err) { api.toast('Could not read the drawing'); api.rerender(); return; }
        D._cand = { cat: cat, boxes: found };
        api.rerender();
      });
    }

    function acceptCandidates() {
      const c = D._cand;
      if (!c) return;
      c.boxes.forEach(b => {
        D.marks.push({
          id: uid(), kind: 'point', group: 'count', cat: c.cat,
          pts: [[b.x, b.y]], mmPerPx: scaleMM(), scaleId: (activeScale() || {}).id || null,
          label: '', waste: 0, depthMM: null, cut: false
        });
      });
      D._cand = null;
      api.touch(); api.rerender();
      api.toast(c.boxes.length + ' counted');
    }

    /* --------------------------------------------------------- to the bill */
    function sendToBill() {
      const boxes = [].slice.call(host.querySelectorAll('[data-dt-map]')).filter(x => x.checked);
      if (!boxes.length) { api.toast('Tick at least one item to send'); return; }
      const ov = api.overrides();
      let n = 0;
      boxes.forEach(x => {
        const cid = x.getAttribute('data-dt-map');
        const sel = host.querySelector(`[data-dt-target="${cid}"]`);
        const key = sel ? sel.getAttribute('data-dt-key') : '';
        if (!key) return;
        const c = totals(D).byCat[cid];
        if (!c) return;
        const prev = ov[key] || {};
        ov[key] = Object.assign({}, prev, { q: round(c.qty, 2) });
        n++;
      });
      api.refresh();
      api.touch();
      api.rerender();
      api.toast(n + ' measured quantit' + (n === 1 ? 'y' : 'ies') + ' sent to the bill');
    }

    /* -------------------------------------------------------------- boot */
    autoScale();
    if (D._cal || D._pick || D._cand) {
      /* transient modes are re-rendered by their own handlers */
    }
    paint();
    paintTable();
    decorateRows();
    liveText();
    paintHint();
    if (D.panX || D.panY) {
      /* the step is rebuilt from scratch on every rerender; keep the corner
         the user had panned to instead of snapping back to the top left */
      requestAnimationFrame(() => {
        viewport.scrollLeft = D.panX || 0;
        viewport.scrollTop = D.panY || 0;
      });
    }
    if (D._cand) {
      D._cand.boxes.forEach(b => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('cx', b.x); el.setAttribute('cy', b.y); el.setAttribute('r', 10 * k());
        el.setAttribute('fill', 'none'); el.setAttribute('stroke', '#b26a0f'); el.setAttribute('stroke-width', 2 * k());
        el.setAttribute('data-cand', '1');
        svg.appendChild(el);
      });
      showCandidateBar(host, D, api);
    }
    if (D._pick) api.toast('Drag a box round one example of the symbol');

    /* keep the row controls in step after every table paint */
    const tEl = host.querySelector('#dt-table');
    if (tEl) new MutationObserver(() => decorateRows()).observe(tEl, { childList: true });
  }

  function showCandidateBar(host, D, api) {
    const sheet = host.querySelector('.dt-sheet');
    if (!sheet || !D._cand) return;
    const bar = document.createElement('div');
    bar.className = 'dt-cand';
    bar.innerHTML = `<b>${D._cand.boxes.length}</b> marks of that size found — add them as
      <b>${catOf('count', D._cand.cat).name.toLowerCase()}</b>?
      <button class="btn sm primary" id="dt-pick-yes">Add ${D._cand.boxes.length}</button>
      <button class="btn sm" id="dt-pick-no">Cancel</button>`;
    const first = sheet.querySelector('#dt-table');
    sheet.insertBefore(bar, first);
  }

  /* Find the other copies of a symbol. The drawing is scanned, so the same
     door is never pixel-identical twice: the patch is matched by correlation,
     which tolerates a line one pixel out of place where an exact match would
     not. Every candidate is shown before it becomes a count. */
  function findRepeats(imgEl, box, cb) {
    try {
      const nw = imgEl.naturalWidth || imgEl.width, nh = imgEl.naturalHeight || imgEl.height;
      if (!nw || !nh) return cb(new Error('no image'));
      const cap = 900;                                  // work small, measure big
      const sc = Math.min(1, cap / Math.max(nw, nh));
      const w = Math.round(nw * sc), h = Math.round(nh * sc);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(imgEl, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < w * h; i++, p += 4)
        gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      const pts = nccMatch(gray, w, h, box.x * sc, box.y * sc, box.w * sc, box.h * sc);
      cb(null, pts.map(pt => ({ x: pt[0] / sc, y: pt[1] / sc })));
    } catch (e) { cb(e); }
  }

  function nccMatch(gray, w, h, bx, by, bw, bh) {
    const mx = Math.max(1, Math.round(bw * 0.10)), my = Math.max(1, Math.round(bh * 0.10));
    const iw = Math.round(bw) - 2 * mx, ih = Math.round(bh) - 2 * my;
    const x0 = Math.round(bx) + mx, y0 = Math.round(by) + my;
    if (iw < 6 || ih < 6 || x0 + iw > w || y0 + ih > h) return [];
    const n = iw * ih;
    let tsum = 0;
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) tsum += gray[(y0 + y) * w + x0 + x];
    const tmean = tsum / n;
    const td = new Float32Array(n);
    let tnorm = 0;
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const v = gray[(y0 + y) * w + x0 + x] - tmean;
      td[y * iw + x] = v; tnorm += v * v;
    }
    if (tnorm / n < 64) return [];                   // a blank sample: nothing to look for
    /* a sample that is really one wall line will match every wall on the
       sheet; ask for a symbol with ink in more than one place */
    const colInk = new Array(iw).fill(0), rowInk = new Array(ih).fill(0);
    let inkN = 0;
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      if (gray[(y0 + y) * w + x0 + x] < 128) { colInk[x]++; rowInk[y]++; inkN++; }
    }
    if (!inkN) return [];
    if (Math.max.apply(null, colInk) > inkN * 0.6 || Math.max.apply(null, rowInk) > inkN * 0.6) return [];
    tnorm = Math.sqrt(tnorm);
    const need = 0.72;
    const stride = 2;
    const hits = [];
    for (let y = 0; y + ih < h; y += stride) {
      for (let x = 0; x + iw < w; x += stride) {
        let sum = 0, sum2 = 0, dot = 0, inkC = 0;
        for (let yy = 0; yy < ih; yy++) {
          const row = (y + yy) * w + x, trow = yy * iw;
          for (let xx = 0; xx < iw; xx++) {
            const v = gray[row + xx];
            sum += v; sum2 += v * v; dot += v * td[trow + xx];
            if (v < 128) inkC++;
          }
        }
        /* a wall running through the box carries far more ink than a symbol */
        if (inkC < inkN * 0.75 || inkC > inkN * 1.9) continue;
        const mean = sum / n;
        const varc = sum2 - n * mean * mean;
        if (varc / n < 16) continue;                   // flat paper: not a symbol
        const ncc = dot / (Math.sqrt(varc) * tnorm);
        if (ncc >= need) hits.push([x + iw / 2, y + ih / 2, ncc]);
      }
    }
    /* strongest first, one mark per symbol */
    hits.sort((a, b) => b[2] - a[2]);
    const kept = [];
    for (const hm of hits) {
      if (kept.length >= 250) break;
      if (Math.abs(hm[0] - (x0 + iw / 2)) < iw * 0.5 && Math.abs(hm[1] - (y0 + ih / 2)) < ih * 0.5) continue;
      if (kept.some(k => Math.abs(k[0] - hm[0]) < iw * 0.6 && Math.abs(k[1] - hm[1]) < ih * 0.6)) continue;
      kept.push(hm);
    }
    return kept.map(k => [k[0], k[1]]);
  }

  root.Digital = { html, mount, measure, totals, blank, GROUPS, TOOLS, MATCH, findRepeats, normUnit };
})(typeof window !== 'undefined' ? window : globalThis);
