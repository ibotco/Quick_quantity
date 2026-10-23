/* =====================================================================
   PDF WRITER — builds a real PDF (no libraries, no network).
   A4 · Helvetica base fonts · cover, preambles, 13 priced bills,
   summary and signature blocks, with automatic pagination and
   repeated table headers.
   ===================================================================== */
(function (root) {
  'use strict';

  const PAGE_W = 595.28, PAGE_H = 841.89;
  const MARGIN_L = 42, MARGIN_R = 42, MARGIN_T = 48, MARGIN_B = 46;
  const CW = PAGE_W - MARGIN_L - MARGIN_R;

  const GREEN = [0.122, 0.306, 0.239];
  const GREEN_HDR = [0.180, 0.420, 0.333];
  const GREEN_L = [0.890, 0.933, 0.910];
  const GREY = [0.400, 0.400, 0.400];
  const LINE = [0.750, 0.780, 0.770];
  const BLACK = [0, 0, 0];
  const WHITE = [1, 1, 1];

  /* ---------------- Helvetica metrics (widths per 1000 units) ---------------- */
  const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

  function textWidth(str, size, bold) {
    let w = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      const v = (c >= 32 && c <= 126) ? W_REG[c - 32] : 556;
      w += v;
    }
    return w * size / 1000 * (bold ? 1.055 : 1);
  }

  /* ---------------- WinAnsi text handling ---------------- */
  const MAP = {
    0x2014: 0x97, 0x2013: 0x96, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94,
    0x2022: 0x95, 0x2026: 0x85, 0x20AC: 0x80, 0x00A2: 0xA2, 0x00B0: 0xB0, 0x00B2: 0xB2,
    0x00B3: 0xB3, 0x00B7: 0xB7, 0x00A3: 0xA3, 0x2044: 0xA4
  };

  function toLatin1(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c >= 0x2000 && c <= 0x206F && MAP[c]) c = MAP[c];
      else if (c > 0xFF) c = 0x3F;
      out.push(c);
    }
    return out;
  }

  function pdfString(str) {
    const bytes = toLatin1(str);
    let s = '(';
    bytes.forEach(b => {
      if (b === 0x28) s += '\\(';
      else if (b === 0x29) s += '\\)';
      else if (b === 0x5C) s += '\\\\';
      else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0');
      else s += String.fromCharCode(b);
    });
    return s + ')';
  }

  const n2 = v => (Math.round(v * 100) / 100).toString();

  /* ---------------- word wrapping ---------------- */
  function wrap(text, size, maxW, bold) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (textWidth(test, size, bold) <= maxW || !line) line = test;
      else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines;
  }

  /* ---------------- document ---------------- */
  function build(result) {
    const r = result, p = r.params;
    const C = p.curSymbol || 'GH\u00a2';
    const pages = [];
    let ops = null;
    let y = 0;
    let pageNo = 0;

    function newPage() {
      ops = [];
      pages.push(ops);
      pageNo++;
      y = PAGE_H - MARGIN_T;
      if (pageNo > 1) {
        // running header
        setColor(ops, GREEN); ops.push('0.6 w');
        ops.push(`${n2(MARGIN_L)} ${n2(PAGE_H - 32)} m ${n2(PAGE_W - MARGIN_R)} ${n2(PAGE_H - 32)} l S`);
        drawText(ops, 'BILL OF QUANTITIES', MARGIN_L, PAGE_H - 26, 6.8, 'F2', GREEN);
        const right = p.projectName + '  |  ' + p.location;
        drawText(ops, right, PAGE_W - MARGIN_R - textWidth(right, 6.8), PAGE_H - 26, 6.8, 'F1', GREY);
      }
      // footer
      setColor(ops, [0.55, 0.55, 0.55]);
      drawText(ops, 'Measured from the uploaded plan  -  Ghana Standard Method of Measurement',
        MARGIN_L, 24, 6.4, 'F1', [0.45, 0.45, 0.45]);
      const pg = 'Page ' + pageNo;
      drawText(ops, pg, PAGE_W - MARGIN_R - textWidth(pg, 6.4), 24, 6.4, 'F1', [0.45, 0.45, 0.45]);
    }

    function space(h) {
      if (y - h < MARGIN_B) newPage();
      return y;
    }

    /* ---- primitives ---- */
    function setColor(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} rg`); }
    function setStroke(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} RG`); }

    function drawText(o, str, x, yTop, size, font, rgb) {
      const c = rgb || BLACK;
      o.push('BT');
      o.push(`${n2(c[0])} ${n2(c[1])} ${n2(c[2])} rg`);
      o.push(`/${font} ${n2(size)} Tf`);
      o.push(`1 0 0 1 ${n2(x)} ${n2(yTop)} Tm`);
      o.push(`${pdfString(String(str))} Tj`);
      o.push('ET');
    }

    function rect(o, x, yTop, w, h, rgb) {
      setColor(o, rgb);
      o.push(`${n2(x)} ${n2(yTop)} ${n2(w)} ${n2(h)} re f`);
    }

    function hline(o, x1, yTop, x2, rgb, w) {
      setStroke(o, rgb || LINE);
      o.push(`${w || 0.5} w`);
      o.push(`${n2(x1)} ${n2(yTop)} m ${n2(x2)} ${n2(yTop)} l S`);
    }

    function paragraph(text, o) {
      o = o || {};
      const size = o.size || 8.8;
      const bold = !!o.bold;
      const font = o.italic ? 'F3' : (bold ? 'F2' : 'F1');
      const lh = size * (o.leading || 1.32);
      const maxW = o.width || CW;
      const lines = wrap(text, size, maxW, bold);
      space(lines.length * lh + (o.after || 0));
      lines.forEach(ln => {
        drawText(ops, ln, MARGIN_L + (o.indent || 0), y - size * 0.92, size, font, o.color || BLACK);
        y -= lh;
      });
      y -= (o.after || 0);
      return lines.length;
    }

    function bar(text) {
      space(24);
      rect(ops, MARGIN_L, y - 15, CW, 15, GREEN);
      drawText(ops, text, MARGIN_L + 6, y - 10.6, 9.6, 'F2', WHITE);
      y -= 15;
    }

    /* ---- table drawing ---- */
    function drawTable(cols, rows, opt) {
      opt = opt || {};
      const size = opt.size || 8;
      const lh = size * 1.26;
      const padY = 3.4;
      const head = opt.header;
      const headH = 15;

      function drawHead() {
        space(headH);
        rect(ops, MARGIN_L, y - headH, CW, headH, GREEN_HDR);
        let x = MARGIN_L;
        head.forEach((h, i) => {
          const c = cols[i];
          const label = typeof h === 'string' ? h : h.text;
          const align = (c.align || 'left');
          let tx = x + 4;
          if (align === 'right') tx = x + c.w - 4 - textWidth(label, size, true);
          if (align === 'center') tx = x + (c.w - textWidth(label, size, true)) / 2;
          drawText(ops, label, tx, y - 10.5, size, 'F2', WHITE);
          x += c.w;
        });
        y -= headH;
      }

      drawHead();

      rows.forEach(row => {
        // wrap each cell
        const cells = row.map((cell, i) => {
          const c = cols[i];
          const txt = cell == null ? '' : String(cell);
          return { txt, lines: wrap(txt, size, c.w - 8, false), c };
        });
        const maxLines = Math.max.apply(null, cells.map(c => c.lines.length));
        const rowH = Math.max(13, maxLines * lh + padY * 2);

        if (y - rowH < MARGIN_B) { newPage(); drawHead(); }

        let x = MARGIN_L;
        cells.forEach(cell => {
          const align = cell.c.align || 'left';
          cell.lines.forEach((ln, li) => {
            let tx = x + 4;
            if (align === 'right') tx = x + cell.c.w - 4 - textWidth(ln, size);
            if (align === 'center') tx = x + (cell.c.w - textWidth(ln, size)) / 2;
            drawText(ops, ln, tx, y - padY - size * 0.92 - li * lh, size, 'F1', BLACK);
          });
          x += cell.c.w;
        });
        y -= rowH;
        hline(ops, MARGIN_L, y, PAGE_W - MARGIN_R, LINE, 0.4);
      });
    }

    /* ================= COVER ================= */
    newPage();
    y -= 4;
    paragraph('REPUBLIC OF GHANA', { size: 9, bold: true, color: GREEN, after: 6 });
    setStroke(ops, GREEN); ops.push('1.4 w');
    ops.push(`${n2(MARGIN_L)} ${n2(y - 2)} m ${n2(MARGIN_L + 210)} ${n2(y - 2)} l S`);
    y -= 26;

    const titleLines = wrap(p.projectName.toUpperCase(), 19, CW, true);
    titleLines.forEach(ln => {
      drawText(ops, ln, MARGIN_L + (CW - textWidth(ln, 19, true)) / 2, y - 14, 19, 'F2', BLACK);
      y -= 22;
    });
    let sub = p.projectSub;
    drawText(ops, sub, MARGIN_L + (CW - textWidth(sub, 11.5)) / 2, y - 10, 11.5, 'F1', GREEN);
    y -= 18;
    const loc = p.location;
    drawText(ops, loc, MARGIN_L + (CW - textWidth(loc, 9)) / 2, y - 8, 9, 'F1', GREY);
    y -= 30;

    rect(ops, MARGIN_L, y - 26, CW, 26, GREEN);
    const boq = 'BILL OF QUANTITIES';
    drawText(ops, boq, MARGIN_L + (CW - textWidth(boq, 14, true)) / 2, y - 18, 14, 'F2', WHITE);
    y -= 44;

    // particulars
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const line = (label, val) => [label, val || '_________________________________________'];
    const party = [];
    party.push(line('Client / Employer', p.client));
    if (p.clientAddr) party.push(['Client address', p.clientAddr]);
    party.push(line('Consultant / Quantity Surveyor', p.consultant));
    if (p.preparedBy) party.push(['Prepared by', p.preparedBy + (p.preparedByRole ? ' — ' + p.preparedByRole : '')]);
    if (p.consultantAddr) party.push(['Consultant address', p.consultantAddr]);
    party.push(line('Contractor (tenderer)', p.contractor));
    if (p.contractorAddr) party.push(['Contractor address', p.contractorAddr]);
    if (p.contractorClass) party.push(['Contractor class / registration', p.contractorClass]);
    if (p.tenderRef) party.push(['Tender reference', p.tenderRef]);
    if (p.contractPeriod) party.push(['Contract period', p.contractPeriod]);
    const part = party.concat([
      ['Drawing reference', 'Uploaded plan image'
        + (p.roofPlan ? ' + roof plan ' + p.roofPlan.file : '')],
      ['Basis of measurement', 'Ghana Standard Method of Measurement of Building Works (GSMMBW)'],
      ['Currency', (p.curLabel || 'Ghana Cedi') + ' (' + C.trim() + ')'],
      ['Date of bill', p.billDate || dateStr],
      ['Gross floor area', r.GFA.toFixed(2) + ' m\u00b2'],
      ['Roof', (p.roofType === 'flat' ? 'Flat, ' : 'Pitched at ' + (+p.roofPitch || 0) + '\u00b0, ')
        + 'eaves overhang ' + (+p.overhang || 0).toFixed(2) + ' m'
        + (p.roofPlan && p.roofPlan.slope
            ? '; the roof plan measures ' + p.roofPlan.slope.toFixed(2) + ' m\u00b2'
              + (p.roofType === 'flat' ? '' : ' at pitch')
            : '')],
      ['Price basis', p.priceNote || 'Q4 2026 Greater Accra market rates']
    ]);
    drawText(ops, 'PROJECT PARTICULARS', MARGIN_L, y - 8, 9.5, 'F2', GREEN);
    y -= 18;
    part.forEach(([k, v]) => {
      const vl = wrap(v, 8.4, CW - 150);
      const h = Math.max(13, vl.length * 11);
      space(h);
      drawText(ops, k, MARGIN_L, y - 8, 8.4, 'F2', BLACK);
      vl.forEach((ln, i) => drawText(ops, ln, MARGIN_L + 150, y - 8 - i * 11, 8.4, 'F1', BLACK));
      y -= h;
      hline(ops, MARGIN_L, y + 3, PAGE_W - MARGIN_R, [0.88, 0.88, 0.88], 0.4);
    });

    y -= 12;
    paragraph('Prepared from a plan picture with Quick Quantity. Quantities measured from the building model; rates are editable. '
      + 'Verify the scale, foundation depth and current supplier prices before issuing for tender.',
      { size: 7.6, italic: true, color: GREY });

    /* ================= PREAMBLES ================= */
    newPage();
    bar('PREAMBLES AND BASIS OF THE BILL');
    y -= 6;
    paragraph('This Bill of Quantities has been measured in accordance with the Ghana Standard Method of Measurement of '
      + 'Building Works and describes the works measured from the uploaded drawing. The quantities are given as accurately '
      + 'as circumstances permit but are not guaranteed; the Contractor is deemed to have satisfied himself as to the site '
      + 'conditions and the means of access. Rates are to be full inclusive rates covering labour, materials, plant, '
      + 'transport, overheads, profit and all obligations under the Conditions of Contract.', { after: 6, size: 8.6 });
    paragraph('The Contractor is required to price every item. Items left unpriced will be deemed covered by the other rates '
      + 'in the Bill. The Bill is not to be altered; corrections are to be made in ink, initialled and dated.', { after: 12, size: 8.6 });

    bar('SUMMARY OF THE PROPOSED ACCOMMODATION');
    y -= 8;
    drawTable(
      [{ w: 240, align: 'center' }, { w: 80, align: 'center' }, { w: 80, align: 'center' }, { w: CW - 400, align: 'right' }],
      [['Accommodation', 'Length (m)', 'Width (m)', 'Area (m\u00b2)']],
      { header: ['Accommodation', 'Length (m)', 'Width (m)', 'Area (m\u00b2)'], size: 8 }
    );
    // rows manually (need the green total row styling)
    r.rooms.forEach(rm => {
      const rowH = 13;
      if (y - rowH < MARGIN_B) newPage();
      drawText(ops, rm.name, MARGIN_L + 4, y - 9, 8, 'F1', BLACK);
      drawText(ops, rm.L.toFixed(2), MARGIN_L + 240 + 80 - 4 - textWidth(rm.L.toFixed(2), 8), y - 9, 8, 'F1', BLACK);
      drawText(ops, rm.W.toFixed(2), MARGIN_L + 320 + 80 - 4 - textWidth(rm.W.toFixed(2), 8), y - 9, 8, 'F1', BLACK);
      const a = (rm.L * rm.W).toFixed(2);
      drawText(ops, a, PAGE_W - MARGIN_R - 4 - textWidth(a, 8), y - 9, 8, 'F1', BLACK);
      y -= rowH;
      hline(ops, MARGIN_L, y, PAGE_W - MARGIN_R, LINE, 0.4);
    });
    if (y - 15 < MARGIN_B) newPage();
    rect(ops, MARGIN_L, y - 15, CW, 15, GREEN_L);
    drawText(ops, 'GROSS FLOOR AREA', MARGIN_L + 4, y - 10.5, 8, 'F2', BLACK);
    const gfa = r.GFA.toFixed(2);
    drawText(ops, gfa, PAGE_W - MARGIN_R - 4 - textWidth(gfa, 8, true), y - 10.5, 8, 'F2', BLACK);
    y -= 22;

    bar('BASIS OF THE QUANTITIES');
    y -= 8;
    const m = r.model;
    [
      'All walls are taken as ' + Math.round(m.p.wallT * 1000) + ' mm thick sandcrete blockwork.',
      'Foundations taken to ' + m.p.foundDepth.toFixed(2) + ' m below ground floor level on firm laterite/gravel; no rock excavation allowed for.',
      'Roof at ' + m.p.roofPitch + '\u00b0 pitch with ' + Math.round(m.p.overhang * 1000) + ' mm eaves overhang, aluminium long-span sheets.',
      'Blockwork ' + m.blockTotal.toFixed(2) + ' m\u00b2 (approx. ' + Math.round(m.blocks).toLocaleString() + ' blocks at 9.7/m\u00b2 \u2014 a 450 \u00d7 225 mm block with 10 mm joints and 5% waste).',
      'Concrete ' + m.concTotal.toFixed(2) + ' m\u00b3 with ' + Math.round(m.rebar).toLocaleString() + ' kg of reinforcement (90 kg/m\u00b3).',
      'Internal plaster ' + m.plasterInt.toFixed(2) + ' m\u00b2; external render ' + m.renderExt.toFixed(2) + ' m\u00b2.',
      'Excluded: furniture and teaching equipment, external electrical reticulation, access roads, boundary wall and land costs.'
    ].forEach(t => paragraph('\u2022  ' + t, { size: 8.3, indent: 6, after: 1.5 }));

    /* ================= BILLS ================= */
    newPage();
    bar('BILL OF QUANTITIES');
    y -= 10;

    const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const qty = (n, u) => Number(n || 0).toLocaleString('en-US', u === 'm3'
      ? { minimumFractionDigits: 3, maximumFractionDigits: 3 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const COLS = [
      { w: 24, align: 'center' }, { w: 262 }, { w: 26, align: 'center' },
      { w: 56, align: 'right' }, { w: 62, align: 'right' }, { w: CW - 430, align: 'right' }
    ];

    r.bills.forEach(b => {
      if (y - 90 < MARGIN_B) newPage();
      bar(b.code + ':  ' + b.title);
      y -= 2;
      const rows = b.items.map((it, i) => [
        String(i + 1).padStart(2, '0'),
        it.desc,
        it.unit,
        qty(it.qty, it.unit),
        money(it.rate),
        money(it.amount)
      ]);
      drawTable(COLS, rows, {
        header: ['Item', 'Description of work', 'Unit', 'Qty', 'Rate (' + C.trim() + ')', 'Amount (' + C.trim() + ')'],
        size: 8
      });
      // total row
      if (y - 15 < MARGIN_B) newPage();
      rect(ops, MARGIN_L, y - 15, CW, 15, GREEN_L);
      const lbl = 'Total carried to Summary \u2014 ' + b.code;
      drawText(ops, lbl, PAGE_W - MARGIN_R - 4 - 76 - textWidth(lbl, 8, true), y - 10.5, 8, 'F2', BLACK);
      drawText(ops, money(b.total), PAGE_W - MARGIN_R - 4 - textWidth(money(b.total), 8, true), y - 10.5, 8, 'F2', BLACK);
      y -= 22;
    });

    /* ================= SUMMARY ================= */
    newPage();
    bar('SUMMARY OF BILLS');
    y -= 10;
    drawTable(
      [{ w: 40, align: 'center' }, { w: 330 }, { w: CW - 370, align: 'right' }],
      r.bills.map(b => [b.code.replace('BILL No. ', ''), b.title, money(b.total)]),
      { header: ['Bill', 'Description', 'Amount (' + C.trim() + ')'], size: 8.4 }
    );

    function totalRow(label, value, highlight) {
      if (y - 15 < MARGIN_B) newPage();
      if (highlight) rect(ops, MARGIN_L, y - 15, CW, 15, GREEN_L);
      const rx = PAGE_W - MARGIN_R - 4;
      drawText(ops, label, rx - 90 - textWidth(label, 8.4, true), y - 10.5, 8.4, 'F2', BLACK);
      drawText(ops, money(value), rx - textWidth(money(value), 8.4, true), y - 10.5, 8.4, 'F2', BLACK);
      y -= 15;
      hline(ops, MARGIN_L, y, PAGE_W - MARGIN_R, LINE, 0.4);
    }
    totalRow('SUB-TOTAL OF BILLS', r.subtotal, true);
    totalRow('Add: contingency allowance at ' + r.params.contingency + '%', r.contingency, false);
    y -= 14;

    // grand total band
    if (y - 40 < MARGIN_B) newPage();
    rect(ops, MARGIN_L, y - 34, CW, 34, GREEN);
    drawText(ops, 'GRAND TOTAL', MARGIN_L + 10, y - 22, 13, 'F2', WHITE);
    const gt = C + money(r.grand);
    drawText(ops, gt, PAGE_W - MARGIN_R - 10 - textWidth(gt, 13, true), y - 22, 13, 'F2', WHITE);
    y -= 46;

    paragraph('Amount in words: ' + words(r.grand, p) + ' Only', { size: 8.8, after: 6 });
    paragraph('The grand total of ' + C + money(r.grand) + ' represents an average of ' + C + money(r.perM2)
      + ' per square metre of gross floor area of ' + r.GFA.toFixed(2) + ' m\u00b2.', { size: 8.8, after: 22 });

    [['For the Client / Employer', p.client], ['For the Consultant (Quantity Surveyor)', p.consultant],
      ['Accepted for the Contractor (tenderer)', p.contractor]].forEach(([label, who]) => {
      paragraph(label + (who ? ' — ' + who : ''), { size: 8.8, bold: true, after: 6 });
      ['Name: ..................................................................................................',
        'Signature & stamp: ...........................................................................',
        'Date: ..................................................................................................']
        .forEach(t => paragraph(t, { size: 8.8, after: 3 }));
      y -= 10;
    });

    /* ---------------- assemble PDF ---------------- */
    return assemble(pages);
  }

  /* ---------------- amount in words ---------------- */
  function words(amount, unit) {
    const S = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
      'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const T = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const h = n => {
      const out = [];
      if (n >= 100) { out.push(S[Math.floor(n / 100)] + ' Hundred'); n %= 100; }
      if (n >= 20) { let t = T[Math.floor(n / 10)]; if (n % 10) t += '-' + S[n % 10]; out.push(t); }
      else if (n > 0) out.push(S[n]);
      return out.join(' ');
    };
    let c = Math.floor(Math.round(amount * 100) / 100);
    const pe = Math.round((Math.round(amount * 100) / 100 - c) * 100);
    const parts = [];
    [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']].forEach(([d, name]) => {
      if (c >= d) { parts.push(h(Math.floor(c / d)) + ' ' + name); c %= d; }
    });
    if (c) parts.push(h(c));
    const u = (unit && (unit.curName || unit.main)) || 'Cedis';
    const sub = (unit && (unit.curSub || unit.sub)) || 'Pesewas';
    let out = (parts.join(' ') || 'Zero') + ' ' + u;
    if (pe) out += ' and ' + h(pe) + ' ' + sub;
    return out;
  }

  /* ---------------- assemble the page objects into a PDF ---------------- */
  function assemble(pages) {
  const objects = [];
  const add = s => { objects.push(s); return objects.length; };

  const contentIds = [];
  const pageObjIds = [];

  // reserve: 1 catalog, 2 pages, 3-5 fonts
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');   // pages object filled later
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');

  pages.forEach(opsArr => {
    const stream = opsArr.join('\n');
    const len = toLatin1(stream).length;
    const cid = add(`<< /Length ${len} >>\nstream\n${stream}\nendstream`);
    contentIds.push(cid);
    pageObjIds.push(add(null));   // placeholder, set below
  });

  pageObjIds.forEach((pid, i) => {
    objects[pid - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(PAGE_W)} ${n2(PAGE_H)}] `
      + `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
  });
  objects[1] = `<< /Type /Pages /Kids [${pageObjIds.map(id => id + ' 0 R').join(' ')}] /Count ${pageObjIds.length} >>`;

  // serialise
  let out = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(toLatin1(out).length);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = toLatin1(out).length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(off => { out += String(off).padStart(10, '0') + ' 00000 n \n'; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const bytes = new Uint8Array(toLatin1(out).length);
  const src = toLatin1(out);
  for (let i = 0; i < src.length; i++) bytes[i] = src[i];
  return new Blob([bytes], { type: 'application/pdf' });
  }

  /* =====================================================================
     MATERIAL SCHEDULE — its own document: one line per material, grouped by
     category, with the quantities and the costs added up.
     ===================================================================== */
  function buildMaterials(mat) {
    const C = String(mat.currency || 'GH\u00a2').trim();

    /* A4 portrait, one material to a line — code, name, category, unit,
       quantity, rate, amount, supplier and remarks, banded by category and
       totalled at the foot. Two passes so the foot of every page can say
       "Page n of N". */
    function render(totalPages) {
      const pages = [];
      let ops = null, y = 0, pageNo = 0;

      const money = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const qty = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 3 });

      /* the remark typed against the material, or the note the rate build-up
         gave it — but not the boilerplate that would print on all 34 assessed
         lines; the footnote below says that once */
      const BOILER = 'supply share of an assessed rate';
      function remarkOf(l) {
        if (l.note && l.note !== BOILER) return { text: l.note, italic: false };
        if (l.recipe) return { text: l.recipe, italic: true };
        return { text: '\u2014', italic: false };
      }

      const COLS = [
        { w: 34, label: 'Code', align: 'left' },
        { w: 134, label: 'Material', align: 'left' },
        { w: 67, label: 'Category', align: 'left' },
        { w: 24, label: 'Unit', align: 'center' },
        { w: 43, label: 'Qty', align: 'right' },
        { w: 41, label: 'Rate', align: 'right' },
        { w: 52, label: 'Total (' + C + ')', align: 'right' },
        { w: 45, label: 'Supplier', align: 'left' },
        { w: 71.28, label: 'Remarks', align: 'left' }
      ];
      const TOTW = COLS.reduce((t, c) => t + c.w, 0);
      const LEAD = 8.2;

      function setColor(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} rg`); }
      function setStroke(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} RG`); }
      function drawText(o, str, x, yTop, size, font, rgb) {
        const c = rgb || BLACK;
        o.push('BT');
        o.push(`${n2(c[0])} ${n2(c[1])} ${n2(c[2])} rg`);
        o.push(`/${font} ${n2(size)} Tf`);
        o.push(`1 0 0 1 ${n2(x)} ${n2(yTop)} Tm`);
        o.push(`${pdfString(String(str))} Tj`);
        o.push('ET');
      }
      function rect(o, x, yTop, w, h, rgb) {
        setColor(o, rgb);
        o.push(`${n2(x)} ${n2(yTop)} ${n2(w)} ${n2(h)} re f`);
      }
      function hline(o, x1, yTop, x2, rgb, w) {
        setStroke(o, rgb || LINE);
        o.push(`${w || 0.4} w`);
        o.push(`${n2(x1)} ${n2(yTop)} m ${n2(x2)} ${n2(yTop)} l S`);
      }
      function space(h) { if (y - h < MARGIN_B) newPage(); return y; }

      function newPage() {
        ops = [];
        pages.push(ops);
        pageNo++;
        y = PAGE_H - MARGIN_T;
        const pg = totalPages > 1 ? 'Page ' + pageNo + ' of ' + totalPages : 'Page ' + pageNo;
        hline(ops, MARGIN_L, 34, PAGE_W - MARGIN_R, [0.80, 0.85, 0.82], 0.5);
        drawText(ops, 'Material schedule  \u00b7  ' + String(mat.projectName || 'Project') + '  \u00b7  Quick Quantity',
          MARGIN_L, 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
        drawText(ops, pg, PAGE_W - MARGIN_R - textWidth(pg, 6.4), 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
      }

      function head() {
        const h = 15;
        space(h + 6);
        rect(ops, MARGIN_L, y - h, TOTW, h, GREEN_HDR);
        let x = MARGIN_L;
        COLS.forEach(c => {
          let tx = x + 3.5;
          if (c.align === 'right') tx = x + c.w - 3.5 - textWidth(c.label, 6.9, true);
          if (c.align === 'center') tx = x + (c.w - textWidth(c.label, 6.9, true)) / 2;
          drawText(ops, c.label, tx, y - 10.2, 6.9, 'F2', WHITE);
          x += c.w;
        });
        y -= h;
      }

      /* ---- the first page: banner, project, the three summary boxes ---- */
      newPage();
      rect(ops, MARGIN_L, y - 52, CW, 52, GREEN);
      drawText(ops, 'MATERIAL SCHEDULE', MARGIN_L + 12, y - 22, 15.5, 'F2', WHITE);
      drawText(ops, 'Every material in the bill, listed by category with its quantity, rate, supplier and remarks',
        MARGIN_L + 12, y - 38, 8.2, 'F1', [0.86, 0.92, 0.89]);
      y -= 66;
      drawText(ops, mat.projectName || 'Project', MARGIN_L, y - 10, 12.5, 'F2', BLACK); y -= 17;
      if (mat.projectSub) { drawText(ops, mat.projectSub, MARGIN_L, y - 8, 9, 'F1', [0.25, 0.25, 0.25]); y -= 13; }
      if (mat.location) { drawText(ops, mat.location, MARGIN_L, y - 8, 9, 'F1', [0.25, 0.25, 0.25]); y -= 13; }
      drawText(ops, 'Currency ' + C + '   \u00b7   ' + mat.date + '   \u00b7   rates from the rate build-up of the bill',
        MARGIN_L, y - 8, 8.2, 'F1', GREY);
      y -= 22;

      const t = mat.totals;
      const boxes = [
        ['MATERIAL TYPES', String(t.types) + ' in ' + t.categories + ' categories'],
        ['TOTAL QUANTITY', qty(t.qty) + ' across ' + t.units + ' units'],
        ['TOTAL MATERIAL COST', C + ' ' + money(t.cost)]
      ];
      const bw = (CW - 20) / 3;
      boxes.forEach((b, i) => {
        const x = MARGIN_L + i * (bw + 10);
        rect(ops, x, y - 32, bw, 32, GREEN_L);
        drawText(ops, b[0], x + 8, y - 12, 6.6, 'F2', GREEN);
        drawText(ops, b[1], x + 8, y - 24.5, 8.2, 'F2', BLACK);
      });
      y -= 44;

      /* ---- the bill it was worked out from ---- */
      const bil = t.bill;
      if (bil) {
        const h = 42;
        space(h + 8);
        rect(ops, MARGIN_L, y - h, CW, h, [0.95, 0.975, 0.962]);
        drawText(ops, 'DERIVED FROM THE BILL OF QUANTITIES', MARGIN_L + 8, y - 11, 6.9, 'F2', GREEN);
        drawText(ops, bil.nBills + ' bills  \u00b7  ' + bil.nItems + ' priced items  \u00b7  bill subtotal ' + C + ' ' + money(bil.subtotal),
          MARGIN_L + 8, y - 21.5, 7.4, 'F1', BLACK);
        drawText(ops, 'carried by materials ' + C + ' ' + money(bil.materials) + '  (' + bil.share + '%)   \u00b7   '
          + 'labour, plant and preliminaries ' + C + ' ' + money(bil.other), MARGIN_L + 8, y - 30.5, 7.4, 'F1', BLACK);
        const tie = 'material schedule ' + C + ' ' + money(bil.schedule)
          + (bil.tied ? '  \u2014  ties to the bill' : '  \u2014  ' + C + ' ' + money(bil.diff) + ' from changes made on the schedule');
        drawText(ops, tie, MARGIN_L + CW - 8 - textWidth(tie, 7.4, true), y - 39, 7.4, 'F2', GREEN);
        y -= h + 10;
      }

      /* ---- the list ---- */
      head();
      mat.groups.forEach(g => {
        const bandH = 14;
        space(bandH + 30);
        rect(ops, MARGIN_L, y - bandH, TOTW, bandH, [0.94, 0.96, 0.95]);
        drawText(ops, g.cat.toUpperCase(), MARGIN_L + 3.5, y - 9.6, 7.2, 'F2', GREEN);
        const cnt = g.lines.length + (g.lines.length === 1 ? ' material' : ' materials');
        drawText(ops, cnt, MARGIN_L + 3.5 + textWidth(g.cat.toUpperCase(), 7.2, true) + 7, y - 9.6, 6.5, 'F1', GREY);
        const gc = C + ' ' + money(g.cost);
        drawText(ops, gc, MARGIN_L + TOTW - 3.5 - textWidth(gc, 7.2, true), y - 9.6, 7.2, 'F2', GREEN);
        y -= bandH;

        g.lines.forEach(l => {
          const cells = [
            { t: l.code, s: 6.7, f: 'F2', c: [0.30, 0.30, 0.30] },
            { t: l.name, s: 7.1, f: 'F1', c: BLACK },
            { t: l.cat, s: 6.5, f: 'F1', c: [0.38, 0.38, 0.38] },
            { t: l.unit, s: 6.7, f: 'F1', c: BLACK },
            { t: qty(l.qty), s: 6.9, f: 'F1', c: BLACK },
            { t: money(l.rate), s: 6.9, f: 'F1', c: BLACK },
            { t: money(l.amount), s: 6.9, f: 'F1', c: BLACK },
            { t: l.sup || '\u2014', s: 6.5, f: 'F1', c: [0.32, 0.32, 0.32] },
            { t: remarkOf(l).text, s: 6.3, f: remarkOf(l).italic ? 'F3' : 'F1', c: [0.44, 0.44, 0.44] }
          ];
          const drawn = cells.map((c, i) => ({ c: c, lines: wrap(c.t, c.s, COLS[i].w - 7) }));
          const nl = Math.max.apply(null, drawn.map(d => d.lines.length));
          const h = Math.max(12.5, nl * LEAD + 4);
          if (y - h < MARGIN_B) { newPage(); head(); }

          let x = MARGIN_L;
          drawn.forEach((d, i) => {
            const col = COLS[i];
            let ty = y - (LEAD - 0.4);
            d.lines.forEach(ln => {
              let tx = x + 3.5;
              if (col.align === 'right') tx = x + col.w - 3.5 - textWidth(ln, d.c.s, d.c.f === 'F2');
              if (col.align === 'center') tx = x + (col.w - textWidth(ln, d.c.s, d.c.f === 'F2')) / 2;
              drawText(ops, ln, tx, ty, d.c.s, d.c.f, d.c.c);
              ty -= LEAD;
            });
            x += col.w;
          });
          hline(ops, MARGIN_L, y - h, MARGIN_L + TOTW, [0.88, 0.90, 0.89], 0.4);
          y -= h;
        });
      });

      /* ---- the total ---- */
      if (y - 44 < MARGIN_B) { newPage(); head(); }
      y -= 8;
      rect(ops, MARGIN_L, y - 26, TOTW, 26, GREEN);
      drawText(ops, 'TOTAL MATERIAL COST', MARGIN_L + 8, y - 16.5, 9.4, 'F2', WHITE);
      const gt = C + ' ' + money(t.cost);
      drawText(ops, gt, MARGIN_L + TOTW - 8 - textWidth(gt, 9.4, true), y - 16.5, 9.4, 'F2', WHITE);
      y -= 40;

      const note = 'The schedule multiplies the quantity of every priced bill item by the materials its rate is built from, '
        + 'adds the same material up across bills, and prices it at the rate in the rate build-up. Items priced as an '
        + 'assessment (doors, fittings, services) carry a supply line at the material share of their rate. '
        + 'Lump-sum allowances inside the rates (sundries, fixings, scaffolding, plant) are shown in the rate build-up, not here.'
        + (t.manual ? ' ' + t.manual + ' material' + (t.manual === 1 ? ' was' : 's were') + ' added by hand.' : '')
        + (t.adjusted ? ' ' + t.adjusted + ' line' + (t.adjusted === 1 ? ' carries' : 's carry') + ' a quantity, rate, supplier or remark entered by hand.' : '');
      wrap(note, 6.8, CW).forEach(ln => {
        space(10);
        drawText(ops, ln, MARGIN_L, y - 7, 6.8, 'F1', [0.42, 0.42, 0.42]);
        y -= 9.4;
      });

      return pages;
    }

    const first = render(0);
    const pages = first.length > 1 ? render(first.length) : first;
    return assemble(pages);
  }


  /* ------------------------------------------------- bar bending schedule */
  /* A4 portrait, one bar mark to a line, banded by member, with the steel
     by diameter and the reconciliation with the bill at the foot. */
  function buildBBS(rows, meta) {
    meta = meta || {};
    const C = String(meta.currency || 'GH\u00a2').trim();

    function render(totalPages) {
      const pages = [];
      let ops = null, y = 0, pageNo = 0;

      const money = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const kg1 = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const int = n => (isFinite(n) ? Math.round(Number(n)) : 0).toLocaleString('en-US');

      const COLS = [
        { w: 34, label: 'Mark', align: 'left' },
        { w: 172, label: 'Member and description', align: 'left' },
        { w: 28, label: 'Bar', align: 'center' },
        { w: 34, label: 'Shape', align: 'center' },
        { w: 48, label: 'No./member', align: 'right' },
        { w: 26, label: 'Bars', align: 'right' },
        { w: 38, label: 'Cut (mm)', align: 'right' },
        { w: 40, label: 'Length (m)', align: 'right' },
        { w: 44, label: 'Weight (kg)', align: 'right' }
      ];
      const TOTW = COLS.reduce((t, c) => t + c.w, 0);
      const LEAD = 8.2;

      function setColor(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} rg`); }
      function setStroke(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} RG`); }
      function drawText(o, str, x, yTop, size, font, rgb) {
        const c = rgb || BLACK;
        o.push('BT');
        o.push(`${n2(c[0])} ${n2(c[1])} ${n2(c[2])} rg`);
        o.push(`/${font} ${n2(size)} Tf`);
        o.push(`1 0 0 1 ${n2(x)} ${n2(yTop)} Tm`);
        o.push(`${pdfString(String(str))} Tj`);
        o.push('ET');
      }
      function rect(o, x, yTop, w, h, rgb) {
        setColor(o, rgb);
        o.push(`${n2(x)} ${n2(yTop)} ${n2(w)} ${n2(h)} re f`);
      }
      function hline(o, x1, yTop, x2, rgb, w) {
        setStroke(o, rgb || LINE);
        o.push(`${w || 0.4} w`);
        o.push(`${n2(x1)} ${n2(yTop)} m ${n2(x2)} ${n2(yTop)} l S`);
      }

      function newPage() {
        ops = [];
        pages.push(ops);
        pageNo++;
        y = PAGE_H - MARGIN_T;
        const pg = totalPages > 1 ? 'Page ' + pageNo + ' of ' + totalPages : 'Page ' + pageNo;
        hline(ops, MARGIN_L, 34, PAGE_W - MARGIN_R, [0.80, 0.85, 0.82], 0.5);
        drawText(ops, 'Bar bending schedule  \u00b7  ' + String(meta.project || 'Project') + '  \u00b7  Quick Quantity',
          MARGIN_L, 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
        drawText(ops, pg, PAGE_W - MARGIN_R - textWidth(pg, 6.4), 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
      }

      function head() {
        const h = 15;
        if (y - h < MARGIN_B + 20) newPage();
        rect(ops, MARGIN_L, y - h, TOTW, h, GREEN_HDR);
        let x = MARGIN_L;
        COLS.forEach(c => {
          let tx = x + 3.5;
          if (c.align === 'right') tx = x + c.w - 3.5 - textWidth(c.label, 6.6, true);
          if (c.align === 'center') tx = x + (c.w - textWidth(c.label, 6.6, true)) / 2;
          drawText(ops, c.label, tx, y - 10.2, 6.6, 'F2', WHITE);
          x += c.w;
        });
        y -= h;
      }

      newPage();
      rect(ops, MARGIN_L, y - 50, CW, 50, GREEN);
      drawText(ops, 'BAR BENDING SCHEDULE', MARGIN_L + 12, y - 21, 15, 'F2', WHITE);
      drawText(ops, 'Every bar mark, its shape, cut length and weight, with the steel added up by diameter',
        MARGIN_L + 12, y - 37, 8, 'F1', [0.86, 0.92, 0.89]);
      y -= 62;
      drawText(ops, meta.project || 'Project', MARGIN_L, y - 10, 12.5, 'F2', BLACK); y -= 17;
      drawText(ops, 'Date ' + (meta.date || '') + '   \u00b7   cut length = legs less 2d per bend, plus hooks and laps   \u00b7   weight = length \u00d7 d\u00b2/162.28 kg/m',
        MARGIN_L, y - 8, 7.6, 'F1', GREY); y -= 20;

      const t = meta.totals || { marks: 0, bars: 0, metres: 0, kg: 0, tonnes: 0 };
      const boxes = [
        ['BAR MARKS', int(t.marks) + ' marks \u00b7 ' + int(t.bars) + ' bars'],
        ['TOTAL LENGTH', kg1(t.metres) + ' m'],
        ['TOTAL STEEL', kg1(t.kg) + ' kg  (' + kg1(t.tonnes) + ' t)']
      ];
      const bw = (CW - 20) / 3;
      boxes.forEach((b, i) => {
        const x = MARGIN_L + i * (bw + 10);
        rect(ops, x, y - 30, bw, 30, GREEN_L);
        drawText(ops, b[0], x + 8, y - 11, 6.4, 'F2', GREEN);
        drawText(ops, b[1], x + 8, y - 23, 8, 'F2', BLACK);
      });
      y -= 44;

      head();
      let last = null;
      (rows || []).forEach(r => {
        const shapeName = r.type === 'mesh' ? 'Mesh' : (BBS && BBS.SHAPES && BBS.SHAPES[r.shape] ? BBS.SHAPES[r.shape].short : 'Bar');
        if (r.member !== last) {
          last = r.member;
          const list = rows.filter(x => x.member === r.member);
          const bandH = 14;
          if (y - bandH < MARGIN_B + 20) { newPage(); head(); }
          rect(ops, MARGIN_L, y - bandH, TOTW, bandH, [0.94, 0.96, 0.95]);
          drawText(ops, String(r.member).toUpperCase(), MARGIN_L + 3.5, y - 9.6, 7.2, 'F2', GREEN);
          const cnt = list.length + (list.length === 1 ? ' mark' : ' marks');
          drawText(ops, cnt, MARGIN_L + 3.5 + textWidth(String(r.member).toUpperCase(), 7.2, true) + 7, y - 9.6, 6.5, 'F1', GREY);
          const sk = kg1(list.reduce((n, x) => n + x.kg, 0)) + ' kg';
          drawText(ops, sk, MARGIN_L + TOTW - 3.5 - textWidth(sk, 7.2, true), y - 9.6, 7.2, 'F2', GREEN);
          y -= bandH;
        }

        const cells = [
          { t: r.mark, s: 6.8, f: 'F2', c: [0.20, 0.20, 0.20] },
          { t: (r.loc || r.member) + (r.note ? '  \u2014 ' + r.note : ''), s: 7.0, f: 'F1', c: BLACK },
          { t: r.type === 'mesh' ? r.spec : 'Y' + r.dia, s: 6.8, f: 'F2', c: BLACK },
          { t: shapeName, s: 6.6, f: 'F1', c: [0.35, 0.35, 0.35] },
          { t: r.type === 'mesh' ? '\u2014' : int(r.no), s: 6.8, f: 'F1', c: BLACK },
          { t: r.type === 'mesh' ? '\u2014' : int(r.bars), s: 6.8, f: 'F1', c: BLACK },
          { t: r.type === 'mesh' ? '\u2014' : int(r.cut), s: 6.8, f: 'F1', c: BLACK },
          { t: r.type === 'mesh' ? '\u2014' : kg1(r.metres), s: 6.8, f: 'F1', c: BLACK },
          { t: kg1(r.kg), s: 7.0, f: 'F2', c: BLACK }
        ];
        const drawn = cells.map((c, i) => ({ c: c, lines: wrap(c.t, c.s, COLS[i].w - 7) }));
        const nl = Math.max.apply(null, drawn.map(d => d.lines.length));
        const h = Math.max(12.5, nl * LEAD + 4);
        if (y - h < MARGIN_B + 16) { newPage(); head(); }

        let x = MARGIN_L;
        drawn.forEach((d, i) => {
          const col = COLS[i];
          let ty = y - (LEAD - 0.4);
          d.lines.forEach(ln => {
            let tx = x + 3.5;
            if (col.align === 'right') tx = x + col.w - 3.5 - textWidth(ln, d.c.s, d.c.f === 'F2');
            if (col.align === 'center') tx = x + (col.w - textWidth(ln, d.c.s, d.c.f === 'F2')) / 2;
            drawText(ops, ln, tx, ty, d.c.s, d.c.f, d.c.c);
            ty -= LEAD;
          });
          x += col.w;
        });
        hline(ops, MARGIN_L, y - h, MARGIN_L + TOTW, [0.88, 0.90, 0.89], 0.4);
        y -= h;
      });

      if (y - 60 < MARGIN_B) { newPage(); head(); }
      y -= 8;
      rect(ops, MARGIN_L, y - 24, TOTW, 24, GREEN);
      drawText(ops, 'TOTAL STEEL', MARGIN_L + 8, y - 15.5, 9, 'F2', WHITE);
      const gt = kg1(t.kg) + ' kg   (' + kg1(t.tonnes) + ' t)';
      drawText(ops, gt, MARGIN_L + TOTW - 8 - textWidth(gt, 9, true), y - 15.5, 9, 'F2', WHITE);
      y -= 34;

      /* by diameter */
      const bd = meta.byDia || [];
      if (bd.length) {
        drawText(ops, 'STEEL BY DIAMETER', MARGIN_L, y - 8, 7.4, 'F2', GREEN); y -= 13;
        const cols = [['Bar', 70], ['Marks', 50], ['Bars', 60], ['Length (m)', 80], ['Weight (kg)', 80], ['% of steel', 60]];
        let x = MARGIN_L;
        cols.forEach(([label, w], i) => {
          drawText(ops, label, x + 2, y - 6, 6.6, 'F2', [0.35, 0.35, 0.35]);
          x += w;
        });
        y -= 11;
        bd.forEach(d => {
          let xx = MARGIN_L;
          const vals = [d.label, int(d.marks), d.dia ? int(d.bars) : '\u2014', d.dia ? kg1(d.metres) : '\u2014',
            kg1(d.kg), t.kg ? (d.kg / t.kg * 100).toFixed(1) + '%' : '\u2014'];
          vals.forEach((v, i) => { drawText(ops, String(v), xx + 2, y - 6, 6.8, 'F1', BLACK); xx += cols[i][1]; });
          y -= 10.4;
        });
        y -= 4;
      }

      /* reconciliation */
      const billKg = (meta.bill && meta.bill.kg) || 0;
      const note = 'The bill carries ' + kg1(billKg) + ' kg of reinforcement. This schedule values '
        + kg1(t.kg) + ' kg (' + (meta.variance > 0 ? '+' : '') + kg1(meta.variance) + ' kg, '
        + (meta.variancePct == null ? '\u2014' : (meta.variancePct > 0 ? '+' : '') + Number(meta.variancePct).toFixed(1) + '%')
        + ' against the bill). Adopt the schedule in the app to price the bill at its weight. '
        + 'Cut length is the developed length of the shape; 9d hooks and laps are included where they apply.';
      wrap(note, 6.8, CW).forEach(ln => {
        if (y - 10 < MARGIN_B) { newPage(); head(); }
        drawText(ops, ln, MARGIN_L, y - 7, 6.8, 'F1', [0.42, 0.42, 0.42]);
        y -= 9.4;
      });

      return pages;
    }

    const first = render(0);
    const pages = first.length > 1 ? render(first.length) : first;
    return assemble(pages);
  }


  /* ---------------------------------------------------------------- labour */
  /* A4 portrait: the trades the bill calls for, their days and hours, the day
     rate and the cost, the crew the programme needs; then the same days bill
     by bill, and the assessed labour that names no trade. */
  function buildLabour(lab) {
    const C = String(lab.currency || 'GH\u00a2').trim();

    function render(totalPages) {
      const pages = [];
      let ops = null, y = 0, pageNo = 0;

      const money = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const num = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const int = n => (isFinite(n) ? Math.round(Number(n)) : 0).toLocaleString('en-US');
      const t = lab.totals || {};

      const COLS = [
        { w: 146, label: 'Trade', align: 'left' },
        { w: 60, label: 'Man-days', align: 'right' },
        { w: 50, label: 'Hours', align: 'right' },
        { w: 60, label: 'Day rate', align: 'right' },
        { w: 78, label: 'Labour cost (' + C + ')', align: 'right' },
        { w: 38, label: 'Crew', align: 'right' },
        { w: 79.28, label: 'Share of days', align: 'right' }
      ];
      const TOTW = COLS.reduce((s, c) => s + c.w, 0);
      const LEAD = 8.2;

      function setColor(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} rg`); }
      function setStroke(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} RG`); }
      function drawText(o, str, x, yTop, size, font, rgb) {
        const c = rgb || BLACK;
        o.push('BT');
        o.push(`${n2(c[0])} ${n2(c[1])} ${n2(c[2])} rg`);
        o.push(`/${font} ${n2(size)} Tf`);
        o.push(`1 0 0 1 ${n2(x)} ${n2(yTop)} Tm`);
        o.push(`${pdfString(String(str))} Tj`);
        o.push('ET');
      }
      function rect(o, x, yTop, w, h, rgb) {
        setColor(o, rgb);
        o.push(`${n2(x)} ${n2(yTop)} ${n2(w)} ${n2(h)} re f`);
      }
      function hline(o, x1, yTop, x2, rgb, w) {
        setStroke(o, rgb || LINE);
        o.push(`${w || 0.4} w`);
        o.push(`${n2(x1)} ${n2(yTop)} m ${n2(x2)} ${n2(yTop)} l S`);
      }

      function newPage() {
        ops = [];
        pages.push(ops);
        pageNo++;
        y = PAGE_H - MARGIN_T;
        const pg = totalPages > 1 ? 'Page ' + pageNo + ' of ' + totalPages : 'Page ' + pageNo;
        hline(ops, MARGIN_L, 34, PAGE_W - MARGIN_R, [0.80, 0.85, 0.82], 0.5);
        drawText(ops, 'Labour schedule  \u00b7  ' + String(lab.projectName || 'Project') + '  \u00b7  Quick Quantity',
          MARGIN_L, 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
        drawText(ops, pg, PAGE_W - MARGIN_R - textWidth(pg, 6.4), 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
      }

      function head() {
        const h = 15;
        if (y - h < MARGIN_B + 20) newPage();
        rect(ops, MARGIN_L, y - h, TOTW, h, GREEN_HDR);
        let x = MARGIN_L;
        COLS.forEach(c => {
          let tx = x + 3.5;
          if (c.align === 'right') tx = x + c.w - 3.5 - textWidth(c.label, 6.2, true);
          drawText(ops, c.label, tx, y - 10.2, 6.2, 'F2', WHITE);
          x += c.w;
        });
        y -= h;
      }

      newPage();
      rect(ops, MARGIN_L, y - 50, CW, 50, GREEN);
      drawText(ops, 'LABOUR SCHEDULE', MARGIN_L + 12, y - 21, 15, 'F2', WHITE);
      drawText(ops, 'The trades the bill calls for, the days and hours each one takes, and what those days cost',
        MARGIN_L + 12, y - 37, 8, 'F1', [0.86, 0.92, 0.89]);
      y -= 62;
      drawText(ops, lab.projectName || 'Project', MARGIN_L, y - 10, 12.5, 'F2', BLACK); y -= 15;
      if (lab.projectSub) { drawText(ops, lab.projectSub, MARGIN_L, y - 8, 8.6, 'F1', [0.18, 0.42, 0.33]); y -= 12; }
      if (lab.location) { drawText(ops, lab.location, MARGIN_L, y - 8, 8, 'F1', GREY); y -= 11; }
      drawText(ops, 'Date ' + (lab.date || '') + '   \u00b7   ' + (t.hoursADay || 8) + '-hour day, 5-day week'
        + '   \u00b7   programme ' + (t.period || 0) + ' weeks (' + (t.workDays || 0) + ' working days)',
        MARGIN_L, y - 8, 7.4, 'F1', GREY);
      y -= 18;

      const boxes = [
        ['TRADES', int(t.trades) + (t.trades === 1 ? ' trade' : ' trades')],
        ['MAN-DAYS', num(t.days) + '  (' + num(t.hours) + ' h)'],
        ['LABOUR COST', C + ' ' + money(t.cost)],
        ['CREW', num(t.crew) + ' men over ' + (t.period || 0) + ' weeks']
      ];
      const bw = (CW - 30) / 4;
      boxes.forEach((b, i) => {
        const x = MARGIN_L + i * (bw + 10);
        rect(ops, x, y - 30, bw, 30, GREEN_L);
        drawText(ops, b[0], x + 8, y - 11, 6.2, 'F2', GREEN);
        drawText(ops, b[1], x + 8, y - 23, 7.6, 'F2', BLACK);
      });
      y -= 44;

      head();
      (lab.trades || []).forEach(tr => {
        const h = tr.blurb ? 19 : 13.5;
        if (y - h < MARGIN_B + 16) { newPage(); head(); }
        const share = t.days ? tr.days / t.days : 0;
        const cells = [
          { t: tr.label, s: 7.4, f: 'F2', c: BLACK },
          { t: num(tr.days), s: 7.4, f: 'F1', c: BLACK },
          { t: num(tr.hours), s: 7.4, f: 'F1', c: BLACK },
          { t: money(tr.rate), s: 7.4, f: 'F1', c: BLACK },
          { t: money(tr.cost), s: 7.4, f: 'F2', c: BLACK },
          { t: num(tr.men), s: 7.4, f: 'F1', c: BLACK },
          { t: (share * 100).toFixed(1) + '%', s: 7.4, f: 'F1', c: [0.35, 0.35, 0.35] }
        ];
        let x = MARGIN_L;
        cells.forEach((c, i) => {
          const col = COLS[i];
          let tx = x + 3.5;
          if (col.align === 'right') tx = x + col.w - 3.5 - textWidth(c.t, c.s, c.f === 'F2');
          drawText(ops, c.t, tx, y - 10, c.s, c.f, c.c);
          x += col.w;
        });
        /* the work the trade does, under its name, in small grey type */
        if (tr.blurb) drawText(ops, tr.blurb, MARGIN_L + 3.5, y - 16.4, 6, 'F1', [0.48, 0.48, 0.48]);
        hline(ops, MARGIN_L, y - h, MARGIN_L + TOTW, [0.88, 0.90, 0.89], 0.4);
        y -= h;
      });

      if (y - 40 < MARGIN_B) { newPage(); head(); }
      rect(ops, MARGIN_L, y - 20, TOTW, 20, GREEN);
      drawText(ops, 'TOTAL LABOUR COST', MARGIN_L + 6, y - 13.4, 8.4, 'F2', WHITE);
      const gt = money(t.cost);
      const labourRight = COLS.slice(0, 5).reduce((a, c) => a + c.w, 0);
      drawText(ops, gt, MARGIN_L + labourRight - 6 - textWidth(gt, 8.4, true), y - 13.4, 8.4, 'F2', WHITE);
      y -= 26;
      drawText(ops, num(t.days) + ' man-days at ' + (t.hoursADay || 8) + ' hours  \u00b7  average '
        + C + ' ' + money(t.avgDay) + ' a man-day  \u00b7  crew ' + num(t.crew) + ' men over '
        + (t.period || 0) + ' weeks', MARGIN_L, y - 8, 6.8, 'F1', GREY);
      y -= 14;

      if (t.assessedCost > 0) {
        const lines = wrap('Assessed labour: a further ' + C + ' ' + money(t.assessedCost) + ' of labour sits inside '
          + t.assessedOnly + ' assessed rates (doors, fittings, services). It names no trade and no time, so it is '
          + 'reported as money and is not turned into days.', 6.6, CW);
        if (y - (lines.length * 8.4 + 10) < MARGIN_B) { newPage(); head(); }
        rect(ops, MARGIN_L, y - (lines.length * 8.4 + 8), TOTW, lines.length * 8.4 + 8, [0.98, 0.96, 0.90]);
        let yy = y - 9;
        lines.forEach(ln => { drawText(ops, ln, MARGIN_L + 6, yy, 6.6, 'F1', [0.42, 0.33, 0.10]); yy -= 8.4; });
        y -= (lines.length * 8.4 + 16);
      }

      /* bill by bill */
      const cols2 = [
        { w: 32, label: 'Bill', align: 'center' },
        { w: 136, label: 'Description', align: 'left' },
        { w: 178, label: 'Trades used', align: 'left' },
        { w: 50, label: 'Man-days', align: 'right' },
        { w: 62, label: 'Labour (' + C + ')', align: 'right' },
        { w: 53.28, label: 'Assessed (' + C + ')', align: 'right' }
      ];
      const TOT2 = cols2.reduce((s, c) => s + c.w, 0);

      function head2() {
        const h = 14;
        if (y - h < MARGIN_B + 20) newPage();
        drawText(ops, 'THE SAME LABOUR, BILL BY BILL', MARGIN_L, y - 8, 7.6, 'F2', GREEN);
        y -= 14;
        rect(ops, MARGIN_L, y - h, TOT2, h, GREEN_HDR);
        let x = MARGIN_L;
        cols2.forEach(c => {
          let tx = x + 3.5;
          if (c.align === 'right') tx = x + c.w - 3.5 - textWidth(c.label, 6.2, true);
          if (c.align === 'center') tx = x + (c.w - textWidth(c.label, 6.2, true)) / 2;
          drawText(ops, c.label, tx, y - 9.6, 6.2, 'F2', WHITE);
          x += c.w;
        });
        y -= h;
      }

      head2();
      (lab.bills || []).forEach(b => {
        const used = b.trades.length ? b.trades.map(x => x.label + ' ' + num(x.days)).join(', ') : '\u2014';
        const bt = wrap(used, 6.6, cols2[2].w - 7);
        const dlines = wrap(b.title || '', 6.8, cols2[1].w - 7);
        const nl = Math.max(bt.length, dlines.length, 1);
        const h = Math.max(12, nl * 8 + 4);
        if (y - h < MARGIN_B + 16) { newPage(); head2(); }
        let x = MARGIN_L;
        const code = String(b.code || '').replace(/BILL\s*No\.?\s*/i, 'B');
        drawText(ops, code, x + (cols2[0].w - textWidth(code, 6.8, true)) / 2, y - 9, 6.8, 'F2', BLACK); x += cols2[0].w;
        dlines.forEach((ln, i) => drawText(ops, ln, x + 3.5, y - 9 - i * 8, 6.8, 'F1', BLACK));
        x += cols2[1].w;
        bt.forEach((ln, i) => drawText(ops, ln, x + 3.5, y - 9 - i * 8, 6.6, 'F1', [0.35, 0.35, 0.35]));
        x += cols2[2].w;
        drawText(ops, num(b.days), x + cols2[3].w - 3.5 - textWidth(num(b.days), 6.8, false), y - 9, 6.8, 'F1', BLACK);
        x += cols2[3].w;
        drawText(ops, money(b.cost), x + cols2[4].w - 3.5 - textWidth(money(b.cost), 6.8, true), y - 9, 6.8, 'F2', BLACK);
        x += cols2[4].w;
        if (b.assessed > 0) drawText(ops, money(b.assessed), x + cols2[5].w - 3.5 - textWidth(money(b.assessed), 6.6, false), y - 9, 6.6, 'F1', [0.42, 0.33, 0.10]);
        hline(ops, MARGIN_L, y - h, MARGIN_L + TOT2, [0.88, 0.90, 0.89], 0.4);
        y -= h;
      });

      if (y - 30 < MARGIN_B) { newPage(); head2(); }
      y -= 4;
      rect(ops, MARGIN_L, y - 18, TOT2, 18, GREEN_L);
      drawText(ops, 'TOTAL', MARGIN_L + 6, y - 12.4, 7.8, 'F2', GREEN);
      const w2 = i => cols2.slice(0, i + 1).reduce((a, c) => a + c.w, 0);
      const totDays = num(t.days);
      drawText(ops, totDays, MARGIN_L + w2(3) - 3.5 - textWidth(totDays, 7.8, false), y - 12.4, 7.8, 'F1', GREEN);
      const totCost = money(t.cost);
      drawText(ops, totCost, MARGIN_L + w2(4) - 3.5 - textWidth(totCost, 7.8, true), y - 12.4, 7.8, 'F2', GREEN);
      const totAss = money(t.assessedCost);
      drawText(ops, totAss, MARGIN_L + TOT2 - 3.5 - textWidth(totAss, 7.8, false), y - 12.4, 7.8, 'F1', GREEN);
      y -= 30;

      const note = 'Every line is multiplied out of a priced bill item: the rate build-up says how much of each trade a '
        + 'unit of work takes (a mason for 0.16 day per square metre of wall), the schedule multiplies that by the quantity '
        + 'in the bill and prices it at the day rate in the rate card. A corrected quantity, a changed rate or a changed day '
        + 'rate moves it. Crew is the man-days divided by the working days in the programme, so a trade needed for a few '
        + 'days reads as a fraction of a man: share it, or bring it in for that week.';
      wrap(note, 6.6, CW).forEach(ln => {
        if (y - 10 < MARGIN_B) { newPage(); head(); }
        drawText(ops, ln, MARGIN_L, y - 7, 6.6, 'F1', [0.42, 0.42, 0.42]);
        y -= 9;
      });

      if (y - 40 < MARGIN_B) { newPage(); head(); }
      y -= 12;
      hline(ops, MARGIN_L, y, PAGE_W - MARGIN_R, [0.80, 0.85, 0.82], 0.5);
      y -= 12;
      ['Prepared by ____________________', 'Checked by ____________________', 'Date ____________'].forEach((s, i) => {
        drawText(ops, s, MARGIN_L + i * (CW / 3), y - 6, 7, 'F1', [0.28, 0.32, 0.30]);
      });
      y -= 16;

      return pages;
    }

    const first = render(0);
    const pages = first.length > 1 ? render(first.length) : first;
    return assemble(pages);
  }


  /* -------------------------------------------------------- cost breakdown */
  /* A4 portrait: the contract sum split into the heads a rate is made of,
     drawn as a bar and then tabulated, and the same money bill by bill. */
  function buildCostBreak(cb) {
    const C = String(cb.currency || 'GH\u00a2').trim();
    const HEAD_COL = [
      ['materials', [0.184, 0.420, 0.322]],
      ['labour', [0.690, 0.486, 0.165]],
      ['plant', [0.290, 0.435, 0.561]],
      ['sundry', [0.482, 0.369, 0.655]],
      ['overheads', [0.490, 0.604, 0.545]],
      ['contingency', [0.788, 0.706, 0.541]]
    ];
    const COLOF = {};
    HEAD_COL.forEach(p => { COLOF[p[0]] = p[1]; });

    function render(totalPages) {
      const pages = [];
      let ops = null, y = 0, pageNo = 0;

      const money = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pct = n => (isFinite(n) ? Number(n) : 0).toFixed(1) + '%';
      const t = cb.totals || {};

      function setColor(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} rg`); }
      function setStroke(o, rgb) { o.push(`${n2(rgb[0])} ${n2(rgb[1])} ${n2(rgb[2])} RG`); }
      function drawText(o, str, x, yTop, size, font, rgb) {
        const c = rgb || BLACK;
        o.push('BT');
        o.push(`${n2(c[0])} ${n2(c[1])} ${n2(c[2])} rg`);
        o.push(`/${font} ${n2(size)} Tf`);
        o.push(`1 0 0 1 ${n2(x)} ${n2(yTop)} Tm`);
        o.push(`${pdfString(String(str))} Tj`);
        o.push('ET');
      }
      function rect(o, x, yTop, w, h, rgb) {
        setColor(o, rgb);
        o.push(`${n2(x)} ${n2(yTop)} ${n2(w)} ${n2(h)} re f`);
      }
      function hline(o, x1, yTop, x2, rgb, w) {
        setStroke(o, rgb || LINE);
        o.push(`${w || 0.4} w`);
        o.push(`${n2(x1)} ${n2(yTop)} m ${n2(x2)} ${n2(yTop)} l S`);
      }
      function newPage() {
        ops = [];
        pages.push(ops);
        pageNo++;
        y = PAGE_H - MARGIN_T;
        const pg = totalPages > 1 ? 'Page ' + pageNo + ' of ' + totalPages : 'Page ' + pageNo;
        hline(ops, MARGIN_L, 34, PAGE_W - MARGIN_R, [0.80, 0.85, 0.82], 0.5);
        drawText(ops, 'Cost breakdown  \u00b7  ' + String(cb.projectName || 'Project') + '  \u00b7  Quick Quantity',
          MARGIN_L, 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
        drawText(ops, pg, PAGE_W - MARGIN_R - textWidth(pg, 6.4), 26, 6.4, 'F1', [0.45, 0.45, 0.45]);
      }

      /* the split, as a bar */
      function bar(amounts, total, width, thick) {
        let x = MARGIN_L;
        (cb.heads || []).forEach(hd => {
          const v = +amounts[hd.id] || 0;
          if (!(v > 0)) return;
          const ww = total > 0 ? width * v / total : 0;
          if (ww > 0.4) rect(ops, x, y - thick, ww, thick, COLOF[hd.id] || [0.5, 0.5, 0.5]);
          x += ww;
        });
      }

      newPage();
      rect(ops, MARGIN_L, y - 50, CW, 50, GREEN);
      drawText(ops, 'COST BREAKDOWN', MARGIN_L + 12, y - 21, 15, 'F2', WHITE);
      drawText(ops, 'The bill read as money: what the contract sum pays for, and where each bill spends it',
        MARGIN_L + 12, y - 37, 8, 'F1', [0.86, 0.92, 0.89]);
      y -= 62;
      drawText(ops, cb.projectName || 'Project', MARGIN_L, y - 10, 12.5, 'F2', BLACK); y -= 15;
      if (cb.projectSub) { drawText(ops, cb.projectSub, MARGIN_L, y - 8, 8.6, 'F1', [0.18, 0.42, 0.33]); y -= 12; }
      if (cb.location) { drawText(ops, cb.location, MARGIN_L, y - 8, 8, 'F1', GREY); y -= 11; }
      drawText(ops, 'Date ' + (cb.date || '') + '   \u00b7   ' + t.bills + ' bills   \u00b7   ' + money(t.GFA)
        + ' m\u00b2   \u00b7   ' + C + ' ' + money(t.perM2) + ' per m\u00b2', MARGIN_L, y - 8, 7.4, 'F1', GREY);
      y -= 18;

      const boxes = [
        ['CONTRACT SUM', C + ' ' + money(t.grand)],
        ['BILLS', C + ' ' + money(t.subtotal)],
        ['CONTINGENCY', C + ' ' + money(t.contingency)],
        ['PER M\u00b2', C + ' ' + money(t.perM2)]
      ];
      const bw = (CW - 30) / 4;
      boxes.forEach((b, i) => {
        const x = MARGIN_L + i * (bw + 10);
        rect(ops, x, y - 30, bw, 30, GREEN_L);
        drawText(ops, b[0], x + 8, y - 11, 6.2, 'F2', GREEN);
        drawText(ops, b[1], x + 8, y - 23, 7.6, 'F2', BLACK);
      });
      y -= 42;

      /* the bar and its legend */
      const amounts = {};
      (cb.heads || []).forEach(h => { amounts[h.id] = h.amount; });
      bar(amounts, t.grand, CW, 13);
      y -= 18;
      let lx = MARGIN_L, ly = y;
      (cb.heads || []).forEach(h => {
        const label = h.label + '  ' + pct(h.pct);
        const wd = textWidth(label, 6.4) + 14;
        if (lx + wd > PAGE_W - MARGIN_R) { lx = MARGIN_L; ly -= 9; }
        rect(ops, lx, ly - 1.4, 6, 6, COLOF[h.id] || [0.5, 0.5, 0.5]);
        drawText(ops, label, lx + 9, ly - 1, 6.4, 'F1', [0.30, 0.34, 0.32]);
        lx += wd;
      });
      y = ly - 14;

      /* ---- where the money goes */
      const c1 = [
        { w: 128, label: 'Cost head', align: 'left' },
        { w: 208, label: 'What it covers', align: 'left' },
        { w: 62, label: 'Amount (' + C + ')', align: 'right' },
        { w: 60, label: '% of sum', align: 'right' },
        { w: 53.28, label: C + ' per m\u00b2', align: 'right' }
      ];
      function head1() {
        if (y - 26 < MARGIN_B) newPage();
        drawText(ops, 'WHERE THE MONEY GOES', MARGIN_L, y - 8, 7.6, 'F2', GREEN);
        y -= 13;
        rect(ops, MARGIN_L, y - 14, CW, 14, GREEN_HDR);
        let x = MARGIN_L;
        c1.forEach(c => {
          const tx = c.align === 'right' ? x + c.w - 3.5 - textWidth(c.label, 6.2, true) : x + 3.5;
          drawText(ops, c.label, tx, y - 9.6, 6.2, 'F2', WHITE);
          x += c.w;
        });
        y -= 14;
      }
      head1();
      (cb.heads || []).forEach(h => {
        const bl = wrap(h.blurb || '', 6, c1[1].w - 7);
        const hh = Math.max(12, bl.length * 7.6 + 4);
        if (y - hh < MARGIN_B + 16) { newPage(); head1(); }
        rect(ops, MARGIN_L + 3.5, y - 9.4, 5, 5, COLOF[h.id] || [0.5, 0.5, 0.5]);
        drawText(ops, h.label, MARGIN_L + 12, y - 9, 7.2, 'F2', BLACK);
        bl.forEach((ln, i) => drawText(ops, ln, MARGIN_L + c1[0].w + 3.5, y - 9 - i * 7.6, 6, 'F1', [0.42, 0.42, 0.42]));
        const amt = money(h.amount);
        drawText(ops, amt, MARGIN_L + c1[0].w + c1[1].w + c1[2].w - 3.5 - textWidth(amt, 7.2, true), y - 9, 7.2, 'F2', BLACK);
        const pc = pct(h.pct);
        drawText(ops, pc, MARGIN_L + c1[0].w + c1[1].w + c1[2].w + c1[3].w - 3.5 - textWidth(pc, 7, false), y - 9, 7, 'F1', [0.35, 0.35, 0.35]);
        if (t.GFA > 0) {
          const pm = money(h.perM2);
          drawText(ops, pm, MARGIN_L + CW - 3.5 - textWidth(pm, 7, false), y - 9, 7, 'F1', [0.35, 0.35, 0.35]);
        }
        hline(ops, MARGIN_L, y - hh, MARGIN_L + CW, [0.90, 0.92, 0.91], 0.4);
        y -= hh;
      });
      y -= 2;
      rect(ops, MARGIN_L, y - 18, CW, 18, GREEN);
      drawText(ops, 'CONTRACT SUM', MARGIN_L + 6, y - 12.4, 7.8, 'F2', WHITE);
      const gsum = money(t.grand);
      drawText(ops, gsum, MARGIN_L + CW - 3.5 - textWidth(gsum, 7.8, true), y - 12.4, 7.8, 'F2', WHITE);
      y -= 26;

      /* ---- every bill */
      const c2 = [
        { w: 26, label: 'Bill', align: 'center' },
        { w: 130, label: 'Description', align: 'left' },
        { w: 54, label: 'Materials', align: 'right' },
        { w: 52, label: 'Labour', align: 'right' },
        { w: 44, label: 'Plant', align: 'right' },
        { w: 44, label: 'Sundries', align: 'right' },
        { w: 50, label: 'O&P', align: 'right' },
        { w: 58, label: 'Amount (' + C + ')', align: 'right' },
        { w: 53.28, label: C + '/m\u00b2', align: 'right' }
      ];
      const T2 = c2.reduce((s, c) => s + c.w, 0);
      function head2() {
        if (y - 30 < MARGIN_B) newPage();
        drawText(ops, 'EVERY BILL, BROKEN DOWN', MARGIN_L, y - 8, 7.6, 'F2', GREEN);
        y -= 13;
        rect(ops, MARGIN_L, y - 14, T2, 14, GREEN_HDR);
        let x = MARGIN_L;
        c2.forEach(c => {
          let tx = x + 3;
          if (c.align === 'right') tx = x + c.w - 3 - textWidth(c.label, 6.2, true);
          else if (c.align === 'center') tx = x + (c.w - textWidth(c.label, 6.2, true)) / 2;
          drawText(ops, c.label, tx, y - 9.6, 6.2, 'F2', WHITE);
          x += c.w;
        });
        y -= 14;
      }
      head2();
      (cb.bills || []).forEach(b => {
        const dl = wrap(b.title || '', 6.6, c2[1].w - 6);
        const hh = Math.max(12, dl.length * 7.8 + 4);
        if (y - hh < MARGIN_B + 16) { newPage(); head2(); }
        const code = String(b.code || '').replace(/BILL\s*No\.?\s*/i, 'B');
        drawText(ops, code, MARGIN_L + (c2[0].w - textWidth(code, 6.8, true)) / 2, y - 9, 6.8, 'F2', BLACK);
        dl.forEach((ln, i) => drawText(ops, ln, MARGIN_L + c2[0].w + 3, y - 9 - i * 7.8, 6.6, 'F1', BLACK));
        const vals = [b.heads.materials, b.heads.labour, b.heads.plant, b.heads.sundry, b.heads.overheads, b.amount];
        let x = MARGIN_L + c2[0].w + c2[1].w;
        vals.forEach((v, i) => {
          const col = c2[2 + i];
          const s = money(v);
          drawText(ops, s, x + col.w - 3 - textWidth(s, 6.8, i === 5), y - 9, 6.8, i === 5 ? 'F2' : 'F1', BLACK);
          x += col.w;
        });
        if (t.GFA > 0) {
          const pm = money(b.perM2);
          drawText(ops, pm, MARGIN_L + T2 - 3 - textWidth(pm, 6.8), y - 9, 6.8, 'F1', [0.35, 0.35, 0.35]);
        }
        hline(ops, MARGIN_L, y - hh, MARGIN_L + T2, [0.90, 0.92, 0.91], 0.4);
        y -= hh;
      });
      if (y - 22 < MARGIN_B) { newPage(); head2(); }
      rect(ops, MARGIN_L, y - 18, T2, 18, GREEN_L);
      drawText(ops, 'TOTAL', MARGIN_L + 6, y - 12.4, 7.8, 'F2', GREEN);
      const tot = [t.materials, t.labour, t.plant, t.sundry, t.overheads, t.subtotal];
      let tx = MARGIN_L + c2[0].w + c2[1].w;
      tot.forEach((v, i) => {
        const col = c2[2 + i];
        const s = money(v);
        drawText(ops, s, tx + col.w - 3 - textWidth(s, 7.4, i === 5), y - 12.4, 7.4, i === 5 ? 'F2' : 'F1', GREEN);
        tx += col.w;
      });
      y -= 26;

      const note = 'Each rate in the build-up is made of materials, labour, plant, sundries and an overheads-and-profit '
        + 'uplift; each assessed rate is split into its supply and fix shares. Multiplying those shares by the money the '
        + 'bill charges gives this page, and the heads add up to the contract sum to the cent. The Labour Schedule prices '
        + 'the measured days at the day rates in the rate card, so its labour figure can differ from the labour column here '
        + 'by the amount the billed rates sit away from their build-ups.';
      wrap(note, 6.6, CW).forEach(ln => {
        if (y - 10 < MARGIN_B) { newPage(); head1(); }
        drawText(ops, ln, MARGIN_L, y - 7, 6.6, 'F1', [0.42, 0.42, 0.42]);
        y -= 9;
      });

      if (y - 40 < MARGIN_B) { newPage(); head1(); }
      y -= 12;
      hline(ops, MARGIN_L, y, PAGE_W - MARGIN_R, [0.80, 0.85, 0.82], 0.5);
      y -= 12;
      ['Prepared by ____________________', 'Checked by ____________________', 'Date ____________'].forEach((s, i) => {
        drawText(ops, s, MARGIN_L + i * (CW / 3), y - 6, 7, 'F1', [0.28, 0.32, 0.30]);
      });
      y -= 16;

      return pages;
    }

    const first = render(0);
    const pages = first.length > 1 ? render(first.length) : first;
    return assemble(pages);
  }


  root.PdfWriter = { build, buildMaterials, buildBBS, buildLabour, buildCostBreak };
})(typeof window !== 'undefined' ? window : globalThis);
