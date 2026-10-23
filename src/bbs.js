/* =====================================================================
   Quick Quantity — the bar bending schedule
   The steel behind the reinforcement item: bar marks, the member each
   one belongs to, the diameter, the shape, how many bars of it, the cut
   length (worked out from the shape's own legs, hooks and bends), the
   total length and the weight. Added up by diameter for the steel
   merchant and by member for the site, and reconciled against the
   reinforcement the bill is carrying.

   Units: dimensions in millimetres, weights in kilograms, mass per
   metre = d² / 162.28 (so 12 mm is 0.888 kg/m, 16 mm 1.578, 20 mm 2.466).
   ===================================================================== */
(function (root) {
  'use strict';

  const KGM = d => (+d || 0) * (+d || 0) / 162.28;

  /* The standard shapes a bar takes. Each carries the legs it needs and a
     cut length in millimetres: the legs added up, less 2d for every bend
     the bar turns through, plus hooks where the shape has them. The
     formula is printed with the shape so the figure can be checked. */
  const SHAPES = {
    straight: {
      label: 'Straight', short: 'Straight', dims: ['a'], bend: 0,
      formula: 'a',
      cut: r => r.a
    },
    L: {
      label: 'L — one bend', short: 'L', dims: ['a', 'b'], bend: 1,
      formula: 'a + b − 2d',
      cut: r => r.a + r.b - 2 * r.dia
    },
    U: {
      label: 'U — two bends', short: 'U', dims: ['a', 'b', 'c'], bend: 2,
      formula: 'a + b + c − 4d',
      cut: r => r.a + r.b + r.c - 4 * r.dia
    },
    Z: {
      label: 'Z — two bends', short: 'Z', dims: ['a', 'b', 'c'], bend: 2,
      formula: 'a + b + c − 4d',
      cut: r => r.a + r.b + r.c - 4 * r.dia
    },
    stirrup: {
      label: 'Rectangular link / stirrup (135° hooks)', short: 'Link', dims: ['a', 'b'], bend: 4,
      formula: '2 × (a + b) + 20d',
      cut: r => 2 * (r.a + r.b) + 20 * r.dia
    },
    crank: {
      label: 'Cranked bar (45° crank)', short: 'Crank', dims: ['a', 'h'], bend: 2,
      formula: 'a + 0.83h',
      cut: r => r.a + 0.828 * (r.h || 0)
    },
    hooks: {
      label: 'Bar with hooks both ends', short: 'Hooks', dims: ['a'], bend: 0,
      formula: 'a + 18d',
      cut: r => r.a + 18 * r.dia
    },
    circle: {
      label: 'Circular link / helix', short: 'Circle', dims: ['a'], bend: 0,
      formula: 'π(a − d) + 20d',
      cut: r => Math.PI * Math.max(0, r.a - r.dia) + 20 * r.dia
    },
    mesh: {
      label: 'Fabric / mesh (measured by area)', short: 'Mesh', dims: [], bend: 0, mesh: true,
      formula: 'area × kg/m²',
      cut: () => 0
    }
  };
  const SHAPE_ORDER = ['straight', 'L', 'U', 'Z', 'stirrup', 'crank', 'hooks', 'circle', 'mesh'];

  const DIMS = {
    straight: [['a', 'Length']],
    L: [['a', 'Long leg'], ['b', 'Short leg']],
    U: [['a', 'First leg'], ['b', 'Second leg'], ['c', 'Third leg']],
    Z: [['a', 'First leg'], ['b', 'Second leg'], ['c', 'Third leg']],
    stirrup: [['a', 'Width'], ['b', 'Depth']],
    crank: [['a', 'Straight length'], ['h', 'Crank depth']],
    hooks: [['a', 'Length between hooks']],
    circle: [['a', 'Outside diameter']],
    mesh: [['a', 'Area covered']]
  };

  const SIZES = [6, 8, 10, 12, 16, 20, 25, 32];

  const MESHES = {
    A98: 1.54, A142: 2.22, A193: 3.02, A252: 3.95, A393: 6.16, A475: 7.46, A565: 8.88
  };

  const MEMBERS = ['Foundation', 'Column bases', 'Columns', 'Beams', 'Slab', 'Staircase', 'Lintels', 'Walls', 'Other'];

  const now = () => new Date().toISOString();

  /* ---------------------------------------------------------------- rows */
  const blank = (over) => Object.assign({
    id: '', mark: '', member: 'Beams', loc: '', type: 'bar',
    dia: 16, shape: 'L', a: 0, b: 0, c: 0, h: 0,
    no: 0, members: 1, lap: 0, spec: 'A142', kgm2: 2.22,
    note: '', src: 'user', at: ''
  }, over || {});

  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  function calc(row) {
    const r = Object.assign(blank(), row);
    if (r.type === 'mesh') {
      const area = num(r.a);
      const kgm2 = num(r.kgm2) || (MESHES[r.spec] || 2.22);
      return Object.assign({}, r, { bars: 1, cut: 0, metres: 0, kgm: kgm2, kg: area * kgm2, area: area });
    }
    const dia = num(r.dia);
    const shape = SHAPES[r.shape] || SHAPES.straight;
    const cut = Math.max(0, Math.round(shape.cut({ a: num(r.a), b: num(r.b), c: num(r.c), h: num(r.h), dia: dia }) + num(r.lap)));
    const perMember = Math.max(0, Math.round(num(r.no)));
    const members = Math.max(1, Math.round(num(r.members) || 1));
    const bars = perMember * members;
    const metres = bars * cut / 1000;
    const kgm = KGM(dia);
    return Object.assign({}, r, { dia: dia, bars: bars, cut: cut, metres: metres, kgm: kgm, kg: metres * kgm });
  }

  const round2 = n => Math.round(n * 100) / 100;

  /* ------------------------------------------------------------- model */
  function rowsOf(p) {
    return (p && p.bbs && Array.isArray(p.bbs.rows)) ? p.bbs.rows : [];
  }

  function billSteel(result) {
    const out = { kg: 0, items: [] };
    ((result && result.bills) || []).forEach(b => {
      (b.items || []).forEach(it => {
        if (String(it.unit).toLowerCase() !== 'kg') return;
        if (!/reinforc|rebar|steel bar|fabric/i.test(String(it.desc))) return;
        out.kg += num(it.qty);
        out.items.push({ bill: b.code, key: it.key || '', desc: it.desc, qty: num(it.qty), rate: num(it.rate) });
      });
    });
    return out;
  }

  /* Bill items that carry concrete — the members the bars belong to. */
  const CONCRETE_KEYS = {
    fdnConc: ['Foundation', 'Strip foundation'],
    raftConc: ['Foundation', 'Raft foundation'],
    colBase: ['Column bases', 'Column bases'],
    colConc: ['Columns', 'Columns'],
    ringBeam: ['Beams', 'Ring beam'],
    beamConc: ['Beams', 'Beams'],
    slabConc: ['Slab', 'Suspended slab'],
    stairConc: ['Staircase', 'Staircase'],
    lintel: ['Lintels', 'Lintels'],
    oversite: ['Slab', 'Oversite slab']
  };

  function concreteMembers(result) {
    const out = [];
    ((result && result.bills) || []).forEach(b => {
      (b.items || []).forEach(it => {
        if (String(it.unit).toLowerCase() !== 'm3') return;
        const hit = it.key && CONCRETE_KEYS[it.key];
        if (!hit) return;
        if (!(num(it.qty) > 0)) return;
        out.push({ key: it.key, member: hit[0], label: hit[1], qty: num(it.qty), bill: b.code, desc: it.desc });
      });
    });
    return out;
  }

  /* A starter schedule that reconciles with the bill: the bill's steel is
     spread over the members at the same kilograms per cubic metre the
     bill itself used, then each member is broken into main bars and links
     of a plausible size. Every line is meant to be edited. */
  const MAIN = {
    Foundation: { dia: 16, len: 4200 },
    'Column bases': { dia: 16, len: 1800 },
    Columns: { dia: 16, len: 3900 },
    Beams: { dia: 16, len: 4800 },
    Slab: { dia: 12, len: 4600 },
    Staircase: { dia: 12, len: 3400 },
    Lintels: { dia: 12, len: 1600 }
  };
  const LINK = {
    Foundation: { dia: 8, w: 300, d: 625 },
    'Column bases': { dia: 8, w: 400, d: 400 },
    Columns: { dia: 8, w: 175, d: 175 },
    Beams: { dia: 8, w: 175, d: 400 },
    Slab: { dia: 8, w: 300, d: 150 },
    Staircase: { dia: 8, w: 300, d: 150 },
    Lintels: { dia: 8, w: 175, d: 175 }
  };

  function starter(p, result) {
    const steel = billSteel(result);
    const members = concreteMembers(result);
    if (!(steel.kg > 0) || !members.length) return { ok: false, rows: [], note: 'The bill carries no measured reinforcement to start from.' };

    /* the oversite is fabric, measured by area, so it is taken out of the
       bill's steel first: what is left is the bars in the members */
    const meshKg = members.reduce((n, m) => n + (m.key === 'oversite' ? (m.qty / 0.1) * 2.22 : 0), 0);
    const barVol = members.reduce((n, m) => n + (m.key === 'oversite' ? 0 : m.qty), 0);
    const kgPerM3 = barVol > 0 ? Math.max(0, steel.kg - meshKg) / barVol : 0;
    const rows = [];
    const prefixes = { Foundation: 'F', 'Column bases': 'CB', Columns: 'C', Beams: 'B', Slab: 'S', Staircase: 'ST', Lintels: 'L' };
    const seq = {};
    const mark = m => {
      seq[m] = (seq[m] || 0) + 1;
      return (prefixes[m] || 'X') + seq[m];
    };

    members.forEach(m => {
      const target = m.key === 'oversite' ? (m.qty / 0.1) * 2.22 : m.qty * kgPerM3;
      if (m.key === 'oversite') {
        // the oversite carries A142 fabric, not bars: 2.22 kg/m² over a 100 mm slab
        const area = m.qty / 0.1;
        rows.push(blank({
          id: 'bbs-' + rows.length, mark: mark(m.member), member: m.member, loc: m.label,
          type: 'mesh', shape: 'mesh', spec: 'A142', kgm2: 2.22, a: Math.round(area),
          note: 'Fabric to the ground-floor slab, laps 300 mm', src: 'bill'
        }));
        return;
      }
      const main = MAIN[m.member] || { dia: 16, len: 4000 };
      const link = LINK[m.member] || { dia: 8, w: 200, d: 300 };
      const mainKg = target * 0.7, linkKg = target * 0.3;

      const mainLen = main.len + 18 * main.dia;                       // hooks both ends
      const mainEach = mainLen / 1000 * KGM(main.dia);
      const mainNo = Math.max(1, Math.round(mainKg / mainEach));

      const linkShape = SHAPES.stirrup;
      const linkLen = linkShape.cut({ a: link.w, b: link.d, dia: link.dia });
      const linkEach = linkLen / 1000 * KGM(link.dia);
      const linkNo = Math.max(1, Math.round(linkKg / linkEach));

      rows.push(blank({
        id: 'bbs-' + rows.length, mark: mark(m.member), member: m.member, loc: m.label + ' — main bars',
        dia: main.dia, shape: 'hooks', a: main.len, no: mainNo, members: 1,
        note: 'Cut length allows 9d hooks both ends', src: 'bill'
      }));
      rows.push(blank({
        id: 'bbs-' + (rows.length), mark: mark(m.member), member: m.member, loc: m.label + ' — links',
        dia: link.dia, shape: 'stirrup', a: link.w, b: link.d, no: linkNo, members: 1,
        note: 'Spaced as the details show', src: 'bill'
      }));
    });

    return { ok: true, rows: rows, kgPerM3: kgPerM3, note: rows.length + ' bar marks started from the bill' };
  }

  function model(p, result) {
    const raw = rowsOf(p);
    const rows = raw.map(calc);
    // a schedule is laid out member by member, and by mark within the member:
    // the print, the workbook and the PDF all follow this order, so a member
    // never appears as two separate bands
    const rank = r => { const i = MEMBERS.indexOf(r.member); return i < 0 ? 99 : i; };
    rows.sort((a, b) => (rank(a) - rank(b)) ||
      String(a.mark).localeCompare(String(b.mark), undefined, { numeric: true }));
    const tot = { marks: rows.length, bars: 0, metres: 0, kg: 0, area: 0 };
    const byDia = {}, byMember = {};
    rows.forEach(r => {
      tot.bars += r.bars; tot.metres += r.metres; tot.kg += r.kg; tot.area += r.area || 0;
      if (r.type === 'mesh') {
        const k = r.spec + ' fabric';
        byDia[k] = byDia[k] || { label: k, dia: 0, bars: 0, metres: 0, kg: 0, marks: 0 };
        byDia[k].marks++; byDia[k].kg += r.kg; byDia[k].metres += 0;
      } else {
        const k = 'Y' + r.dia;
        byDia[k] = byDia[k] || { label: k, dia: r.dia, bars: 0, metres: 0, kg: 0, marks: 0 };
        byDia[k].marks++; byDia[k].bars += r.bars; byDia[k].metres += r.metres; byDia[k].kg += r.kg;
      }
      const mb = byMember[r.member] = byMember[r.member] || { member: r.member, marks: 0, bars: 0, metres: 0, kg: 0 };
      mb.marks++; mb.bars += r.bars; mb.metres += r.metres; mb.kg += r.kg;
    });
    const steel = billSteel(result);
    const byDiaList = Object.keys(byDia).map(k => byDia[k]).sort((a, b) => (a.dia - b.dia) || a.label.localeCompare(b.label));
    const byMemberList = Object.keys(byMember).map(k => byMember[k]);

    return {
      rows: rows,
      totals: {
        marks: tot.marks, bars: tot.bars, metres: round2(tot.metres),
        kg: round2(tot.kg), tonnes: round2(tot.kg / 1000), area: round2(tot.area)
      },
      byDia: byDiaList,
      byMember: byMemberList,
      bill: { kg: round2(steel.kg), items: steel.items, tonnes: round2(steel.kg / 1000) },
      variance: round2(tot.kg - steel.kg),
      variancePct: steel.kg > 0 ? round2((tot.kg - steel.kg) / steel.kg * 100) : null,
      empty: rows.length === 0
    };
  }

  /* --------------------------------------------------------------- edits */
  function ensure(p) {
    if (!p.bbs || typeof p.bbs !== 'object') p.bbs = { rows: [], seq: 0 };
    if (!Array.isArray(p.bbs.rows)) p.bbs.rows = [];
    return p.bbs;
  }

  function nextId(p) {
    const b = ensure(p);
    b.seq = (num(b.seq) || 0) + 1;
    return 'bbs-' + Date.now().toString(36) + '-' + b.seq;
  }

  function nextMark(p, member) {
    const rows = rowsOf(p);
    const pref = { Foundation: 'F', 'Column bases': 'CB', Columns: 'C', Beams: 'B', Slab: 'S', Staircase: 'ST', Lintels: 'L', Walls: 'W' }[member] || 'X';
    let n = 1;
    const used = {};
    rows.forEach(r => { used[String(r.mark).toUpperCase()] = true; });
    while (used[(pref + n).toUpperCase()]) n++;
    return pref + n;
  }

  function add(p, row) {
    const b = ensure(p);
    const r = blank(row);
    r.id = nextId(p);
    r.at = now();
    r.src = row && row.src ? row.src : 'user';
    b.rows.push(r);
    return r;
  }

  function update(p, id, patch) {
    const b = ensure(p);
    const i = b.rows.findIndex(r => r.id === id);
    if (i < 0) return null;
    b.rows[i] = Object.assign({}, b.rows[i], patch, { at: now() });
    return b.rows[i];
  }

  function remove(p, id) {
    const b = ensure(p);
    const n = b.rows.length;
    b.rows = b.rows.filter(r => r.id !== id);
    return b.rows.length !== n;
  }

  function duplicate(p, id) {
    const b = ensure(p);
    const src = b.rows.find(r => r.id === id);
    if (!src) return null;
    const copy = blank(src);
    copy.id = nextId(p);
    copy.mark = nextMark(p, src.member);
    copy.loc = (src.loc || '') + ' (copy)';
    copy.src = 'user';
    copy.at = now();
    b.rows.push(copy);
    return copy;
  }

  function replaceAll(p, rows) {
    const b = ensure(p);
    b.rows = (rows || []).map(r => {
      const c = blank(r);
      c.id = nextId(p);
      c.at = now();
      return c;
    });
    return b.rows.length;
  }

  function clear(p) {
    const b = ensure(p);
    b.rows = [];
  }

  const exportRows = m => m.rows.map(r => [
    r.mark, r.member, r.loc, r.type === 'mesh' ? r.spec : ('Y' + r.dia),
    r.type === 'mesh' ? 'Mesh' : (SHAPES[r.shape] || SHAPES.straight).short,
    r.type === 'mesh' ? '' : r.no, r.type === 'mesh' ? '' : r.members,
    r.type === 'mesh' ? '' : r.cut, r.type === 'mesh' ? r.area : round2(r.metres),
    r.type === 'mesh' ? r.kgm2 : round2(r.kgm), round2(r.kg), r.note
  ]);

  root.BBS = {
    KGM, SHAPES, SHAPE_ORDER, DIMS, SIZES, MESHES, MEMBERS,
    blank, calc, model, starter, rowsOf, ensure, add, update, remove, duplicate,
    replaceAll, clear, nextMark, exportRows, billSteel, concreteMembers
  };
})(typeof window !== 'undefined' ? window : globalThis);
