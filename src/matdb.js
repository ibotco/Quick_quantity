/* =====================================================================
   Quick Quantity — the materials database
   The catalogue of materials kept on this device: every code, name,
   group, unit, indicative rate, supplier and specification the practice
   has priced before. The app ships with 757 materials read off the
   project materials schedule (M.1 cements … M.21 pre-mix concrete);
   from there the database is the user's own — add, change, duplicate,
   retire, import a supplier's price list, export it back out.

   Storage is localStorage, one record to a row, synthetic ids because
   the schedule's own codes are not unique (M.12.1.57 appears twice).
   A seed version lets a later build add new lines without touching the
   ones the user has since edited.
   ===================================================================== */
(function (root) {
  'use strict';

  const KEY = 'plan2boq.matdb';
  const SEED_VER = 'matdb.v1';
  const VER = 1;

  const now = () => new Date().toISOString();
  const slugId = s => String(s == null ? '' : s).trim();

  /* ------------------------------------------------------------- storage */
  let cache = null;

  function blank() {
    return { v: VER, seed: '', rows: {}, order: [], groups: [] };
  }

  function read() {
    if (cache) return cache;
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || db.v !== VER || !db.rows) db = blank();
    if (!Array.isArray(db.order)) db.order = Object.keys(db.rows);
    if (!Array.isArray(db.groups)) db.groups = [];
    cache = db;
    return cache;
  }

  function write() {
    const db = read();
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return { ok: true };
    } catch (err) {
      // a full quota is the only realistic failure: say so instead of losing a record silently
      return { ok: false, error: 'This device is out of storage for the materials database. Export it and remove a few records.' };
    }
  }

  /* ------------------------------------------------------------- seeds */
  const CAT = () => (typeof Catalogue !== 'undefined' ? Catalogue : null);

  function seedRows() {
    const C = CAT();
    if (!C || !Array.isArray(C.ROWS)) return [];
    const n = {};
    return C.ROWS.map(r => {
      const code = String(r[0] || '').trim();
      n[code] = (n[code] || 0) + 1;
      return {
        id: 'matdb:' + code + '#' + n[code],
        code: code,
        name: String(r[1] || ''),
        cat: String(r[2] || 'Miscellaneous'),
        sub: String(r[3] || ''),
        unit: String(r[4] || 'No.'),
        rate: (r[5] === null || r[5] === undefined || r[5] === '') ? null : +r[5],
        desc: String(r[6] || ''),
        sup: '',
        note: '',
        src: 'cat',
        at: ''
      };
    });
  }

  const seedKeyOf = rec => String(rec.code || '') + '\u0001' + String(rec.name || '');

  /* Bring the shipped catalogue into the device store. Existing records
     are never overwritten: only lines that are missing are added, so a
     rate the user has corrected survives every later build. */
  function seed(force) {
    const db = read();
    if (!force && db.seed === SEED_VER) return { added: 0, seeded: false };
    const have = {};
    Object.keys(db.rows).forEach(id => { have[seedKeyOf(db.rows[id])] = true; });
    let added = 0;
    seedRows().forEach(rec => {
      if (have[seedKeyOf(rec)]) return;
      // a user record that already carries this code+name keeps its id
      db.rows[rec.id] = rec;
      db.order.push(rec.id);
      added++;
    });
    (CAT() ? CAT().CATS : []).forEach(c => { if (db.groups.indexOf(c) < 0) db.groups.push(c); });
    db.seed = SEED_VER;
    write();
    return { added: added, seeded: true };
  }

  /* ------------------------------------------------------------- the rows */
  function all() {
    const db = read();
    const out = [];
    db.order.forEach(id => { const r = db.rows[id]; if (r) out.push(r); });
    Object.keys(db.rows).forEach(id => { if (db.order.indexOf(id) < 0) out.push(db.rows[id]); });
    return out;
  }

  function get(id) {
    const db = read();
    return db.rows[id] || null;
  }

  function byCode(code) {
    const c = String(code || '').trim();
    return all().filter(r => r.code === c);
  }

  function nextId(code) {
    const db = read();
    let n = 1;
    while (db.rows['matdb:' + code + '#' + n]) n++;
    return 'matdb:' + code + '#' + n;
  }

  function normalise(rec) {
    const r = {
      id: rec.id || '',
      code: slugId(rec.code),
      name: slugId(rec.name),
      cat: slugId(rec.cat) || 'Miscellaneous',
      sub: slugId(rec.sub),
      unit: slugId(rec.unit) || 'No.',
      rate: (rec.rate === '' || rec.rate === null || rec.rate === undefined) ? null : (+rec.rate || 0),
      desc: slugId(rec.desc),
      sup: slugId(rec.sup),
      note: slugId(rec.note),
      src: rec.src || 'user',
      at: now()
    };
    if (!r.rate) r.rate = r.rate === 0 ? 0 : null;
    return r;
  }

  /* Save one record. A new record's id is made from its code, with a
     counter when that code already exists. */
  function save(rec) {
    const db = read();
    if (!rec || !slugId(rec.name)) return { ok: false, error: 'A material needs a name.' };
    const r = normalise(rec);
    const isNew = !r.id || !db.rows[r.id];
    if (isNew) r.id = nextId(r.code || 'MAT');
    else r.at = now();
    db.rows[r.id] = Object.assign({}, db.rows[r.id] || {}, r);
    if (isNew) db.order.push(r.id);
    if (db.groups.indexOf(r.cat) < 0) db.groups.push(r.cat);
    const w = write();
    return w.ok ? { ok: true, rec: db.rows[r.id] } : w;
  }

  /* A copy of a record under a fresh id — the quickest way to add the
     same product in a different size or from a different supplier. */
  function duplicate(id) {
    const src = get(id);
    if (!src) return { ok: false, error: 'That material is no longer in the database.' };
    const copy = Object.assign({}, src, {
      id: '', name: src.name + ' (copy)', src: 'user', at: ''
    });
    const out = save(copy);
    if (out.ok) out.rec.code = out.rec.code || src.code;
    return out;
  }

  function remove(id) {
    const db = read();
    if (!db.rows[id]) return { ok: false, error: 'That material is no longer in the database.' };
    delete db.rows[id];
    db.order = db.order.filter(x => x !== id);
    return write();
  }

  function removeMany(ids) {
    const db = read();
    let n = 0;
    (ids || []).forEach(id => { if (db.rows[id]) { delete db.rows[id]; n++; } });
    db.order = db.order.filter(x => db.rows[x]);
    const w = write();
    return w.ok ? { ok: true, removed: n } : w;
  }

  function setGroupMany(ids, cat, sub) {
    const db = read();
    let n = 0;
    (ids || []).forEach(id => {
      const r = db.rows[id];
      if (!r) return;
      r.cat = cat || r.cat;
      if (sub !== undefined) r.sub = sub;
      r.at = now();
      n++;
    });
    if (cat && db.groups.indexOf(cat) < 0) db.groups.push(cat);
    const w = write();
    return w.ok ? { ok: true, changed: n } : w;
  }

  /* ------------------------------------------------------------- searching */
  const norm = s => String(s == null ? '' : s).toLowerCase();

  /* the shipped order — M.1 cements, M.2 aggregates … — so the list reads
     the way the materials schedule does, not alphabetically */
  function groupRank(cat) {
    const C = CAT();
    const g = C && C.GROUP ? C.GROUP[cat] : '';
    const m = /^M\.(\d+)/.exec(String(g || ''));
    return m ? +m[1] : 900;
  }

  function match(rec, q) {
    if (!q) return true;
    const hay = norm([rec.code, rec.name, rec.cat, rec.sub, rec.unit, rec.sup, rec.desc, rec.note].join(' '));
    return q.split(/\s+/).every(w => hay.indexOf(w) >= 0);
  }

  function search(q, opts) {
    opts = opts || {};
    const query = norm(q).trim();
    const cat = opts.cat || 'all';
    const unit = opts.unit || 'all';
    const sort = opts.sort || 'group';
    let rows = all().filter(r => match(r, query) && (cat === 'all' || r.cat === cat) && (unit === 'all' || r.unit === unit));

    const codeKey = r => String(r.code).split('.').map(x => ('000000' + x).slice(-6)).join('');
    const cmp = {
      group: (a, b) => {
        if (a.cat === b.cat) return codeKey(a).localeCompare(codeKey(b));
        const ra = groupRank(a.cat), rb = groupRank(b.cat);
        return (ra - rb) || a.cat.localeCompare(b.cat);
      },
      code: (a, b) => codeKey(a).localeCompare(codeKey(b)),
      name: (a, b) => a.name.localeCompare(b.name),
      rate: (a, b) => ((b.rate || -1) - (a.rate || -1)) || a.name.localeCompare(b.name),
      priced: (a, b) => ((a.rate == null ? 1 : 0) - (b.rate == null ? 1 : 0)) || a.name.localeCompare(b.name),
      recent: (a, b) => String(b.at || '').localeCompare(String(a.at || ''))
    }[sort] || null;
    if (cmp) rows.sort(cmp);
    if (opts.dir === 'desc' && cmp) rows.reverse();

    const total = rows.length;
    const size = opts.pageSize || 0;
    let page = 1, pages = 1;
    if (size) {
      pages = Math.max(1, Math.ceil(total / size));
      page = Math.min(Math.max(1, +opts.page || 1), pages);
      rows = rows.slice((page - 1) * size, page * size);
    }
    const priced = rows.filter(r => r.rate != null).length;
    return { rows: rows, total: total, page: page, pages: pages, priced: priced };
  }

  /* ------------------------------------------------------------- groups */
  function groups() {
    const db = read();
    const seen = {}, out = [];
    db.groups.forEach(g => { if (g && !seen[g]) { seen[g] = { cat: g, count: 0, priced: 0 }; out.push(seen[g]); } });
    Object.keys(db.rows).forEach(id => {
      const r = db.rows[id];
      if (!seen[r.cat]) { seen[r.cat] = { cat: r.cat, count: 0, priced: 0 }; out.push(seen[r.cat]); }
      seen[r.cat].count++;
      if (r.rate != null) seen[r.cat].priced++;
    });
    out.sort((a, b) => (groupRank(a.cat) - groupRank(b.cat)) || a.cat.localeCompare(b.cat));
    return out;
  }

  function groupAdd(name) {
    const db = read();
    const g = slugId(name);
    if (!g) return { ok: false, error: 'Give the group a name.' };
    if (db.groups.indexOf(g) >= 0) return { ok: false, error: 'That group already exists.' };
    db.groups.push(g);
    const w = write();
    return w.ok ? { ok: true, name: g } : w;
  }

  function groupRename(from, to) {
    const db = read();
    const a = slugId(from), b = slugId(to);
    if (!a || !b) return { ok: false, error: 'Both names are needed.' };
    if (a !== b && db.groups.indexOf(b) >= 0) return { ok: false, error: 'A group called ' + b + ' already exists.' };
    let n = 0;
    Object.keys(db.rows).forEach(id => { if (db.rows[id].cat === a) { db.rows[id].cat = b; n++; } });
    db.groups = db.groups.map(g => (g === a ? b : g));
    const w = write();
    return w.ok ? { ok: true, moved: n } : w;
  }

  function groupRemove(name, moveTo) {
    const db = read();
    const a = slugId(name), b = slugId(moveTo) || 'Miscellaneous';
    const count = Object.keys(db.rows).filter(id => db.rows[id].cat === a).length;
    if (!count) {
      db.groups = db.groups.filter(g => g !== a);
      const w = write();
      return w.ok ? { ok: true, moved: 0, into: b } : w;
    }
    if (a === b) return { ok: false, error: 'Pick a different group to move the materials to.' };
    let n = 0;
    Object.keys(db.rows).forEach(id => { if (db.rows[id].cat === a) { db.rows[id].cat = b; n++; } });
    db.groups = db.groups.filter(g => g !== a);
    if (n && db.groups.indexOf(b) < 0) db.groups.push(b);
    const w = write();
    return w.ok ? { ok: true, moved: n, into: b } : w;
  }

  /* ------------------------------------------------------------- units */
  const UNITS = ['m2', 'm3', 'm', 'kg', 't', 'No.', 'Item', 'L', 'day', 'bag', 'sheet', 'drum',
    'box', 'set', 'trip', 'coil', 'pc', 'roll', 'pack', 'pair', 'length', 'litre', 'mtr'];

  function units() {
    const seen = {};
    UNITS.forEach(u => { seen[u] = true; });
    all().forEach(r => { if (r.unit) seen[r.unit] = true; });
    return Object.keys(seen).sort((a, b) => UNITS.indexOf(a) - UNITS.indexOf(b) || a.localeCompare(b));
  }

  function stats() {
    const rows = all();
    const gs = groups().filter(g => g.count);
    return {
      total: rows.length,
      priced: rows.filter(r => r.rate != null).length,
      groups: gs.length,
      suppliers: Object.keys(rows.reduce((m, r) => { if (r.sup) m[r.sup] = 1; return m; }, {})).length,
      user: rows.filter(r => r.src === 'user').length
    };
  }

  /* ------------------------------------------------------------- export / import */
  const HEAD = ['Code', 'Name', 'Group', 'Sub-group', 'Unit', 'Rate', 'Supplier', 'Description', 'Notes'];

  function exportRows(ids) {
    const pick = ids && ids.length ? all().filter(r => ids.indexOf(r.id) >= 0) : all();
    return pick.map(r => [r.code, r.name, r.cat, r.sub, r.unit, r.rate == null ? '' : r.rate, r.sup, r.desc, r.note]);
  }

  function toCSV(ids) {
    const q = v => {
      const s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [HEAD].concat(exportRows(ids)).map(r => r.map(q).join(',')).join('\r\n');
  }

  /* Parse CSV / TSV text. Quotes, embedded commas and CRLF are handled;
     a header row is read if the first line names the columns. */
  function parseTable(text) {
    const t = String(text || '').replace(/^\uFEFF/, '');
    const sep = (t.split('\n')[0].split('\t').length > t.split('\n')[0].split(',').length) ? '\t' : ',';
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }

  const COLMAP = {
    code: ['code', 'item', 'ref', 'item code'],
    name: ['name', 'material', 'description of material', 'item name', 'material name'],
    cat: ['group', 'category', 'group name', 'section'],
    sub: ['sub-group', 'sub group', 'subgroup', 'subsection'],
    unit: ['unit', 'uom', 'unit of measure'],
    rate: ['rate', 'price', 'unit rate', 'unit price', 'amount'],
    sup: ['supplier', 'vendor', 'source'],
    desc: ['description', 'specification', 'spec', 'details', 'long description'],
    note: ['notes', 'note', 'remarks', 'remark', 'comment']
  };
  function mapHeader(h) {
    const k = norm(h).replace(/[_\-]+/g, ' ').trim();
    for (const field in COLMAP) if (COLMAP[field].indexOf(k) >= 0) return field;
    return '';
  }

  function importRows(records, opts) {
    opts = opts || {};
    if (typeof records === 'string') records = parseTable(records);
    records = records || [];
    // a grid straight from Excel or a CSV file: the first line names the columns
    if (records.length && Array.isArray(records[0])) {
      const mapped = records[0].map(mapHeader);
      const named = mapped.filter(Boolean).length >= 2;
      const body = named ? records.slice(1) : records;
      const head = named ? mapped : HEAD.map(mapHeader);
      records = body.map(r => {
        const o = {};
        head.forEach((f, i) => { if (f) o[f] = r[i]; });
        return o;
      });
    }
    const list = (records || []).map(r => {
      const o = {};
      Object.keys(r).forEach(k => { const f = mapHeader(k) || k; o[f] = r[k]; });
      return o;
    }).filter(o => slugId(o.name) || slugId(o.code));

    if (opts.mode === 'replace') {
      const db = read();
      db.rows = {}; db.order = [];
      write();
    }
    let added = 0, updated = 0, skipped = 0;
    const bySeed = {};
    all().forEach(r => { bySeed[norm(r.code) + '|' + norm(r.name)] = r; });
    list.forEach(o => {
      const rec = {
        code: o.code, name: o.name, cat: o.cat || opts.cat || 'Miscellaneous',
        sub: o.sub, unit: o.unit || 'No.',
        rate: (o.rate === '' || o.rate == null) ? null : parseFloat(String(o.rate).replace(/[^0-9.\-]/g, '')),
        sup: o.sup, desc: o.desc, note: o.note,
        src: 'user'
      };
      if (!slugId(rec.name)) { skipped++; return; }
      const hit = bySeed[norm(rec.code) + '|' + norm(rec.name)];
      if (hit && opts.mode !== 'append') {
        rec.id = hit.id;
        const w = save(rec);
        if (w.ok) updated++; else skipped++;
      } else {
        const w = save(rec);
        if (w.ok) added++; else skipped++;
      }
    });
    return { ok: true, added: added, updated: updated, skipped: skipped, read: list.length };
  }

  /* What a picker asks for: a few suggestions for what is being typed. */
  function pick(q, limit) {
    const s = search(q, { sort: 'group', pageSize: 0 });
    return s.rows.slice(0, limit || 8);
  }

  /* ------------------------------------------------- where the database answers the rate build-up
     Each market input the app prices from, and the catalogue line that
     answers it. The number is the conversion from the catalogue's unit to
     the app's: a rod is kept per kg and the bill wants the tonne, so 1000;
     binding wire is kept per 8.78 kg roll and the bill wants the kg. */
  const LINKS = {
    cement32: ['M.1.1', 1],
    cement42: ['M.1.2', 1],
    whiteCement: ['M.1.4', 1],
    sand: ['M.2.7', 1],
    plasterSand: ['M.2.8', 1],
    aggregate: ['M.2.3', 1],
    laterite: ['M.2.10', 1],
    block100: ['M.4.2', 1],
    block150: ['M.4.6', 1],
    block225: ['M.4.10', 1],
    brick: ['M.4.24', 1],
    rebar: ['M.3.2.2', 1000],
    mesh: ['M.3.3.2', 1],
    bindingWire: ['M.3.3.10', 1 / 8.78],
    hardwood: ['M.6.10', 1 / 0.015],
    softwood: ['M.6.7', 1 / 0.005],
    plywood: ['M.6.20', 1],
    formPly: ['M.6.19', 1],
    roofSheet: ['M.7.2', 1],
    roofSheetIBR: ['M.7.8', 1],
    roofTile: ['M.7.25', 1],
    polythene: ['M.17.3', 1],
    ceilingBoard: ['M.8.2', 1],
    fibreBoard: ['M.8.7', 1],
    tiles: ['M.14.2.22', 1],
    wallTiles: ['M.14.1.1', 1],
    porcelain: ['M.14.2.8', 1],
    paint: ['M.15.6', 20],
    glossPaint: ['M.15.23', 20],
    primerPaint: ['M.15.5', 20],
    flushDoor: ['M.9.12', 1],
    panelDoor: ['M.9.3', 1],
    glass: ['M.10.2.2', 1],
    wcSuite: ['M.12.1.3', 1],
    basinSet: ['M.12.1.13', 1],
    sinkSet: ['M.12.1.27', 1],
    showerSet: ['M.12.1.17', 1],
    floorGully: ['M.12.1.57', 1],
    waterTank: ['M.12.1.64', 1],
    paving: ['M.5.1', 1],
    kerb: ['M.5.18', 1]
  };

  function linkPrices() {
    const out = {};
    Object.keys(LINKS).forEach(input => {
      const pair = LINKS[input];
      const hit = all().filter(r => r.code === pair[0] && r.rate != null)[0];
      if (hit) out[input] = Math.round(hit.rate * pair[1] * 100) / 100;
    });
    return out;
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
    cache = null;
    seed(true);
  }

  function clearAll() {
    const db = read();
    db.rows = {}; db.order = []; db.groups = []; db.seed = '';
    cache = db;
    write();
  }

  root.MatDB = {
    KEY: KEY, SEED_VER: SEED_VER, UNITS: UNITS, HEAD: HEAD,
    seed: seed, all: all, get: get, byCode: byCode, save: save, duplicate: duplicate,
    remove: remove, removeMany: removeMany, setGroupMany: setGroupMany,
    search: search, groups: groups, groupAdd: groupAdd, groupRename: groupRename,
    groupRemove: groupRemove, units: units, stats: stats,
    exportRows: exportRows, toCSV: toCSV, parseTable: parseTable, importRows: importRows,
    pick: pick, reset: reset, clearAll: clearAll,
    LINKS: LINKS, linkPrices: linkPrices
  };

  // open the database with the shipped catalogue already in it
  try { read(); seed(false); } catch (e) { /* storage off: the app still runs */ }
})(typeof window !== 'undefined' ? window : globalThis);
