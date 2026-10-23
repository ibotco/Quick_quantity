/* =====================================================================
   XLSX WRITER — builds a real .xlsx workbook from the BOQ result.
   Sheets: Summary · Bill of Quantities · Quantities & Assumptions
   ===================================================================== */
(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  const colName = n => {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };

  // style indexes defined in styles.xml
  const S = { normal: 0, bold: 1, title: 2, sub: 3, hdr: 4, money: 5, qty: 6, totalLbl: 7, total: 8, date: 9, wrap: 10, center: 11,
    pct: 12, pctTotal: 13 };

  function cell(ref, value, style) {
    if (value === '' || value == null) return `<c r="${ref}" s="${style || 0}"/>`;
    if (typeof value === 'number' && isFinite(value)) {
      return `<c r="${ref}" s="${style || 0}"><v>${value}</v></c>`;
    }
    return `<c r="${ref}" s="${style || 0}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  }

  function sheet(rows, cols, merges, freeze, name) {
    const colsXml = cols && cols.length
      ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const rowsXml = rows.map((r, ri) => {
      const cells = r.cells.map((c, ci) => cell(colName(ci + 1) + (ri + 1), c.v, c.s)).join('');
      return `<row r="${ri + 1}"${r.h ? ` ht="${r.h}" customHeight="1"` : ''}>${cells}</row>`;
    }).join('');
    const mergeXml = merges && merges.length
      ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
    const freezeXml = freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const pageXml = `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${freezeXml}${colsXml}<sheetData>${rowsXml}</sheetData>${mergeXml}${pageXml}</worksheet>`;
  }

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
  <numFmt numFmtId="164" formatCode="#,##0.00"/>
  <numFmt numFmtId="165" formatCode="#,##0.000"/>
  <numFmt numFmtId="166" formatCode="0.0%"/>
</numFmts>
<fonts count="6">
  <font><sz val="10"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><name val="Calibri"/></font>
  <font><b/><sz val="16"/><name val="Calibri"/></font>
  <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><i/><sz val="9"/><color rgb="FF666666"/><name val="Calibri"/></font>
</fonts>
<fills count="5">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E3D"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE3EEE8"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF2F7F4"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left style="thin"><color rgb="FFD8E0DB"/></left><right style="thin"><color rgb="FFD8E0DB"/></right><top style="thin"><color rgb="FFD8E0DB"/></top><bottom style="thin"><color rgb="FFD8E0DB"/></bottom><diagonal/></border>
  <border><left/><right/><top/><bottom style="medium"><color rgb="FF1F4E3D"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
  <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf>
  <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf>
  <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>
  <xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>
  <xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center"/></xf>
  <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf>
  <xf numFmtId="166" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function build(result, opts) {
    const r = result, p = r.params;
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    /* ---------------- sheet 1 : bill ---------------- */
    const C = (p.curSymbol || 'GH¢').trim();
    const rows = [];
    const merges = [];
    let n = 1;
    const push = (cells, h) => { rows.push({ cells, h }); return n++; };
    const blank = () => push([{ v: '' }]);

    push([{ v: 'BILL OF QUANTITIES', s: S.title }], 26); merges.push('A1:F1');
    push([{ v: p.projectName, s: S.sub }], 18); merges.push('A2:F2');
    push([{ v: p.projectSub, s: S.normal }]); merges.push('A3:F3');
    push([{ v: p.location, s: S.normal }]); merges.push('A4:F4');
    const partyLines = [];
    if (p.client) partyLines.push('Client: ' + p.client + (p.clientAddr ? ', ' + p.clientAddr : ''));
    if (p.consultant) partyLines.push('Consultant: ' + p.consultant + (p.consultantAddr ? ', ' + p.consultantAddr : ''));
    if (p.contractor) partyLines.push('Contractor: ' + p.contractor + (p.contractorAddr ? ', ' + p.contractorAddr : '')
      + (p.contractorClass ? ' (' + p.contractorClass + ')' : ''));
    if (partyLines.length) { push([{ v: partyLines.join('    |    '), s: S.wrap }], 28); merges.push(`A${n - 1}:F${n - 1}`); }
    push([{ v: 'Currency: ' + (p.curLabel || 'Ghana Cedi') + ' (' + C + ')   ·   Basis: Ghana Standard Method of Measurement   ·   Date: ' + (p.billDate || dateStr)
      + (p.tenderRef ? '   ·   Ref: ' + p.tenderRef : ''), s: S.wrap }]); merges.push(`A${n - 1}:F${n - 1}`);
    blank();

    r.bills.forEach((b, bi) => {
      push([{ v: b.code + ':  ' + b.title, s: S.hdr, }], 20);
      merges.push(`A${n - 1}:F${n - 1}`);
      push([{ v: 'Item', s: S.hdr }, { v: 'Description of work', s: S.hdr }, { v: 'Unit', s: S.hdr },
            { v: 'Qty', s: S.hdr }, { v: 'Rate (' + C + ')', s: S.hdr }, { v: 'Amount (' + C + ')', s: S.hdr }], 16);
      b.items.forEach((it, i) => {
        push([
          { v: String(i + 1).padStart(2, '0'), s: S.center },
          { v: it.desc, s: S.wrap },
          { v: it.unit, s: S.center },
          { v: it.qty, s: it.unit === 'm3' ? S.qty : S.money },
          { v: it.rate, s: S.money },
          { v: it.amount, s: S.money }
        ], Math.max(16, 13 * Math.ceil(it.desc.length / 70)));
      });
      push([{ v: '', s: S.total }, { v: 'Total carried to Summary — ' + b.code, s: S.totalLbl },
            { v: '', s: S.total }, { v: '', s: S.total }, { v: '', s: S.total }, { v: b.total, s: S.total }], 18);
      blank();
    });

    push([{ v: 'SUMMARY OF BILLS', s: S.hdr }], 20); merges.push(`A${n - 1}:F${n - 1}`);
    push([{ v: 'Bill', s: S.hdr }, { v: 'Description', s: S.hdr }, { v: '', s: S.hdr }, { v: '', s: S.hdr }, { v: '', s: S.hdr }, { v: 'Amount (' + C + ')', s: S.hdr }], 16);
    r.bills.forEach(b => {
      push([{ v: b.code.replace('BILL No. ', ''), s: S.center }, { v: b.title, s: S.wrap },
            { v: '', s: S.wrap }, { v: '', s: S.wrap }, { v: '', s: S.wrap }, { v: b.total, s: S.money }], 16);
    });
    push([{ v: '', s: S.total }, { v: 'SUB-TOTAL OF BILLS', s: S.totalLbl }, { v: '', s: S.total },
          { v: '', s: S.total }, { v: '', s: S.total }, { v: r.subtotal, s: S.total }], 18);
    push([{ v: '', s: S.total }, { v: 'Contingency at ' + p.contingency + '%', s: S.totalLbl }, { v: '', s: S.total },
          { v: '', s: S.total }, { v: '', s: S.total }, { v: r.contingency, s: S.total }], 18);
    push([{ v: '', s: S.total }, { v: 'GRAND TOTAL', s: S.hdr }, { v: '', s: S.hdr },
          { v: '', s: S.hdr }, { v: '', s: S.hdr }, { v: r.grand, s: S.total }], 22);

    const billSheet = sheet(rows, [6, 70, 8, 12, 14, 16], merges, 0, 'BoQ');

    /* ---------------- sheet 2 : summary & basis ---------------- */
    const r2 = [];
    const m2 = [];
    let k = 1;
    const add2 = (cells, h) => { r2.push({ cells, h }); return k++; };
    add2([{ v: 'BUILDING SUMMARY AND BASIS OF THE BILL', s: S.title }], 24); m2.push('A1:D1');
    add2([{ v: p.projectName, s: S.sub }], 18); m2.push('A2:D2');
    add2([{ v: '' }]);
    add2([{ v: 'Item', s: S.hdr }, { v: 'Value', s: S.hdr }, { v: 'Unit', s: S.hdr }, { v: 'Basis', s: S.hdr }], 16);
    const basis = r.model;
    [
      ['Gross floor area', r.GFA, 'm2', 'Sum of room areas'],
      ['Footprint (outer face)', basis.g.footprint, 'm2', 'Overall plan area'],
      ['Overall width', basis.g.mainW, 'm', 'Taken from the plan and confirmed scale'],
      ['Overall depth', basis.g.totalD, 'm', 'Main block + office wing'],
      ['Roof area at pitch', basis.g.roofArea, 'm2', p.roofPlan
        ? 'Roof plan ' + (p.roofPlan.file || '') + ' read at ' + (+p.roofPlan.pitch || 0) + ' deg'
        : 'Roof plan / cos(pitch)'],
      ['Blockwork', basis.blockTotal, 'm2', 'Walls net of openings + balustrade'],
      ['Blocks required', Math.round(basis.blocks), 'No.', '9.7 blocks/m2: 450 x 225 mm block, 10 mm joints, 5% waste'],
      ['Concrete', basis.concTotal, 'm3', 'Footings, bases, oversite, columns, ring beam, lintels'],
      ['Reinforcement', Math.round(basis.rebar), 'kg', '90 kg/m3 of concrete'],
      ['Plaster (internal)', basis.plasterInt, 'm2', 'Internal faces net of openings'],
      ['External render', basis.renderExt, 'm2', 'External faces + balustrade'],
      ['Sub-total of bills', r.subtotal, C, 'Sum of bills'],
      ['Contingency', r.contingency, C, p.contingency + '% of sub-total'],
      ['GRAND TOTAL', r.grand, C, 'Carried to form of tender'],
      ['Cost per m2', r.perM2, C + '/m2', 'Grand total / gross floor area'],
      ['Price basis', r.params.priceNote || 'Q4 2026 Greater Accra market rates', '', 'Source of the rates used']
    ].forEach(row => {
      add2([{ v: row[0], s: S.wrap }, { v: row[1], s: S.money }, { v: row[2], s: S.center }, { v: row[3], s: S.wrap }], 16);
    });
    add2([{ v: '' }]);
    add2([{ v: 'Accommodation schedule', s: S.sub }], 18); m2.push(`A${k - 1}:D${k - 1}`);
    add2([{ v: 'Room', s: S.hdr }, { v: 'Length (m)', s: S.hdr }, { v: 'Width (m)', s: S.hdr }, { v: 'Area (m2)', s: S.hdr }], 16);
    r.rooms.forEach(rm => add2([{ v: rm.name, s: S.wrap }, { v: rm.L, s: S.money }, { v: rm.W, s: S.money }, { v: rm.L * rm.W, s: S.money }], 16));
    add2([{ v: 'Gross floor area', s: S.totalLbl }, { v: '', s: S.total }, { v: '', s: S.total }, { v: r.GFA, s: S.total }], 18);
    add2([{ v: '' }]);
    add2([{ v: 'Rates are indicative Q4 2026 Greater Accra market rates. Verify against current supplier quotations before tender.', s: S.wrap }], 26);
    m2.push(`A${k - 1}:D${k - 1}`);
    add2([{ v: '' }]);
    add2([{ v: 'SIGNATURES', s: S.sub }], 18); m2.push(`A${k - 1}:D${k - 1}`);
    [['For the Client / Employer', p.client], ['For the Consultant (Quantity Surveyor)', p.consultant],
      ['Accepted for the Contractor (tenderer)', p.contractor]].forEach(([label, who]) => {
      add2([{ v: label, s: S.hdr }, { v: who || '', s: S.wrap }], 16);
      add2([{ v: 'Name / signature & stamp / date', s: S.wrap }, { v: '..............................................', s: S.wrap }], 16);
    });

    const sumSheet = sheet(r2, [34, 16, 10, 64], m2, 0, 'Summary');

    /* ---------------- sheet 3 : rate schedule and price basis ---------------- */
    const r3 = [];
    const add3 = (cells, h) => { r3.push({ cells, h }); return r3.length; };
    const rb = (typeof root.RateBuild !== 'undefined') ? root.RateBuild.list(r) : [];
    add3([{ v: 'RATE SCHEDULE AND PRICE BASIS', s: S.title }], 24);
    add3([{ v: p.projectName, s: S.sub }], 18);
    add3([{ v: '' }]);
    add3([{ v: 'Source of the rates', s: S.hdr }, { v: p.priceNote || 'Built-in Q4 2026 Greater Accra market rates', s: S.wrap }], 24);
    add3([{ v: 'Country and currency', s: S.hdr }, { v: (p.country || 'Ghana') + '  ·  ' + C, s: S.wrap }], 16);
    add3([{ v: 'Rate card dated', s: S.hdr }, { v: p.ratesBasisDate || '2026-10-01', s: S.wrap }], 16);
    add3([{ v: 'Cedi index applied', s: S.hdr }, { v: Math.abs((Number(p.fxApplied) || 1) - 1) < 0.0005 ? 'none' : (((Number(p.fxApplied) - 1) * 100).toFixed(1) + '%'), s: S.wrap }], 16);
    add3([{ v: '' }]);
    add3([{ v: 'Item', s: S.hdr }, { v: 'Unit', s: S.hdr }, { v: 'Rate', s: S.hdr }, { v: 'Amount in bill', s: S.hdr }], 18);
    if (rb.length) {
      rb.forEach(e => add3([{ v: e.desc, s: S.wrap }, { v: e.unit, s: S.center },
        { v: e.rate, s: S.money }, { v: e.amount, s: S.money }], 16));
      add3([{ v: 'Total of the rates above', s: S.totalLbl }, { v: '', s: S.total },
        { v: '', s: S.total }, { v: rb.reduce((a, e) => a + e.amount, 0), s: S.total }], 18);
    } else {
      add3([{ v: 'Rate key', s: S.hdr }, { v: '', s: S.hdr }, { v: 'Rate', s: S.hdr }, { v: '', s: S.hdr }], 18);
      Object.keys(p.rates || {}).sort().forEach(k => add3([{ v: k, s: S.wrap }, { v: '', s: S.wrap },
        { v: p.rates[k], s: S.money }, { v: '', s: S.wrap }], 16));
    }
    add3([{ v: '' }]);
    add3([{ v: 'Every rate can be changed in the app before the bill is issued; the amounts above follow the quantities measured from the drawing.', s: S.wrap }], 24);
    const rateSheet = sheet(r3, [58, 10, 14, 16], [], 0, 'Rates');

    /* ---------------- package ---------------- */
    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Bill of Quantities - ${esc(p.projectName)}</dc:title><dc:creator>Quick Quantity</dc:creator>
<cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${today.toISOString()}</dcterms:created>
</cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Bill of Quantities" sheetId="1" r:id="rId1"/><sheet name="Summary and Basis" sheetId="2" r:id="rId2"/><sheet name="Rates" sheetId="3" r:id="rId3"/></sheets>
</workbook>`);
    zip.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', sheet(rows, [6, 70, 8, 12, 14, 16], merges, 0, 'BoQ'));
    zip.add('xl/worksheets/sheet2.xml', sumSheet);
    zip.add('xl/worksheets/sheet3.xml', rateSheet);
    return zip.build();
  }

  /* =====================================================================
     MATERIAL SCHEDULE — a workbook of its own: one row per material,
     grouped by category, with the quantities and the costs added up.
     ===================================================================== */
  function buildMaterials(mat) {
    const C = String(mat.currency || 'GH\u00a2').trim();
    const rows = [], merges = [];
    const push = (cells, h) => { rows.push({ cells, h }); return rows.length; };
    const blank = () => push([{ v: '' }]);

    push([{ v: 'MATERIAL SCHEDULE', s: S.title }], 26); merges.push('A1:I1');
    push([{ v: mat.projectName || 'Project', s: S.sub }], 18); merges.push('A2:I2');
    if (mat.projectSub) { push([{ v: mat.projectSub, s: S.normal }]); merges.push(`A${rows.length}:I${rows.length}`); }
    if (mat.location) { push([{ v: mat.location, s: S.normal }]); merges.push(`A${rows.length}:I${rows.length}`); }
    push([{ v: 'Currency: ' + C + '   ·   Date: ' + mat.date + '   ·   Quantities from the bill, prices from the rate build-up', s: S.wrap }], 20);
    merges.push(`A${rows.length}:I${rows.length}`);
    const t = mat.totals;
    push([{ v: t.types + ' material types in ' + t.categories + ' categories   ·   '
      + t.qty.toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' of quantity across ' + t.units + ' units   ·   total cost '
      + C + ' ' + t.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), s: S.bold }], 20);
    merges.push(`A${rows.length}:I${rows.length}`);

    /* the bill the schedule was worked out from, and how the two compare */
    const money0 = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const bil = t.bill;
    if (bil) {
      push([{ v: 'DERIVED FROM THE BILL OF QUANTITIES   \u00b7   ' + bil.nBills + ' bills, ' + bil.nItems + ' items'
        + '   \u00b7   bill subtotal ' + C + ' ' + money0(bil.subtotal)
        + '   \u00b7   carried by materials ' + C + ' ' + money0(bil.materials) + ' (' + bil.share + '%)'
        + '   \u00b7   labour, plant and preliminaries ' + C + ' ' + money0(bil.other), s: S.wrap }], 20);
      merges.push(`A${rows.length}:I${rows.length}`);
      push([{ v: 'Material schedule ' + C + ' ' + money0(bil.schedule) + (bil.tied
        ? ' \u2014 ties to the bill' + (Math.abs(bil.diff) >= 0.01 ? ' (difference ' + C + ' ' + money0(bil.diff) + ' is line rounding)' : '')
        : ' \u2014 ' + C + ' ' + money0(bil.diff) + ' from changes made on the schedule')
        + '   \u00b7   every line is multiplied out of a priced bill item; press a line on screen to see which.', s: S.wrap }], 20);
      merges.push(`A${rows.length}:I${rows.length}`);
    }
    blank();

    push([{ v: 'Code', s: S.hdr }, { v: 'Material', s: S.hdr }, { v: 'Category', s: S.hdr },
          { v: 'Unit', s: S.hdr }, { v: 'Quantity required', s: S.hdr }, { v: 'Unit rate (' + C + ')', s: S.hdr },
          { v: 'Total cost (' + C + ')', s: S.hdr }, { v: 'Supplier', s: S.hdr }, { v: 'Remarks', s: S.hdr }], 26);

    mat.groups.forEach(g => {
      push([{ v: g.cat.toUpperCase() + '   ·   ' + g.lines.length + (g.lines.length === 1 ? ' material' : ' materials'), s: S.totalLbl },
            { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
            { v: 'Subtotal', s: S.totalLbl }, { v: g.cost, s: S.total }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }], 18);
      g.lines.forEach(l => {
        push([
          { v: l.code, s: S.center },
          { v: l.name, s: S.wrap },
          { v: l.cat, s: S.wrap },
          { v: l.unit, s: S.center },
          { v: l.qty, s: S.qty },
          { v: l.rate, s: S.money },
          { v: l.amount, s: S.money },
          { v: l.sup || '', s: S.wrap },
          { v: l.note || '', s: S.wrap }
        ], Math.max(16, 13 * Math.ceil(String(l.name).length / 46)));
      });
    });

    push([{ v: 'TOTAL MATERIAL COST', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: '', s: S.totalLbl }, { v: t.qty, s: S.total }, { v: '', s: S.totalLbl },
          { v: t.cost, s: S.total }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }], 20);

    blank();
    const note = 'The schedule multiplies the quantity of every priced bill item by the materials its rate is built from, adds '
      + 'the same material up across bills, and prices it at the rate in the rate build-up. Items priced as an assessment '
      + '(doors, fittings, services) carry a supply line at the material share of their rate. Lump-sum allowances inside the '
      + 'rates (sundries, fixings, scaffolding, plant) are shown in the rate build-up, not here.'
      + (t.manual ? ' ' + t.manual + ' material' + (t.manual === 1 ? ' was' : 's were') + ' added by hand.' : '')
      + (t.adjusted ? ' ' + t.adjusted + ' line' + (t.adjusted === 1 ? ' carries' : 's carry') + ' an entry made by hand.' : '');
    push([{ v: note, s: S.wrap }], 40);
    merges.push(`A${rows.length}:I${rows.length}`);

    const ws = sheet(rows, [10, 46, 18, 8, 14, 14, 15, 18, 30], merges, 8, 'Material Schedule');

    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Material Schedule - ${esc(mat.projectName || 'Project')}</dc:title><dc:creator>Quick Quantity</dc:creator>
<cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Material Schedule" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', ws);
    return zip.build();
  }


  /* ---------------------------------------------------------- catalogue */
  /* The materials database as a workbook: one row per material, grouped
     by its own group bands, with the rate and supplier that are kept on
     this device. It reads straight back into the app. */
  function buildCatalogue(list, meta) {
    meta = meta || {};
    const C = String(meta.currency || 'GH\u00a2').trim();
    const rows = [], merges = [];
    const push = (cells, h) => { rows.push({ cells, h }); return rows.length; };
    const blank = () => push([{ v: '' }]);

    push([{ v: 'MATERIALS DATABASE', s: S.title }], 26); merges.push('A1:I1');
    push([{ v: meta.title || 'Materials on this device', s: S.sub }], 18); merges.push('A2:I2');
    push([{ v: 'Currency: ' + C + '   \u00b7   Date: ' + meta.date + '   \u00b7   '
      + (list.length) + ' materials   \u00b7   ' + (meta.priced || 0) + ' with a rate', s: S.wrap }], 20);
    merges.push(`A${rows.length}:I${rows.length}`);
    if (meta.note) { push([{ v: meta.note, s: S.wrap }], 30); merges.push(`A${rows.length}:I${rows.length}`); }
    blank();

    push([{ v: 'Code', s: S.hdr }, { v: 'Material', s: S.hdr }, { v: 'Group', s: S.hdr },
          { v: 'Sub-group', s: S.hdr }, { v: 'Unit', s: S.hdr }, { v: 'Rate (' + C + ')', s: S.hdr },
          { v: 'Supplier', s: S.hdr }, { v: 'Description', s: S.hdr }, { v: 'Notes', s: S.hdr }], 26);

    let group = null;
    list.forEach(r => {
      if (r.cat !== group) {
        group = r.cat;
        push([{ v: String(group).toUpperCase(), s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
              { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
              { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }], 18);
      }
      push([
        { v: r.code, s: S.center },
        { v: r.name, s: S.wrap },
        { v: r.cat, s: S.wrap },
        { v: r.sub || '', s: S.wrap },
        { v: r.unit, s: S.center },
        { v: r.rate == null ? '' : r.rate, s: r.rate == null ? S.center : S.money },
        { v: r.sup || '', s: S.wrap },
        { v: r.desc || '', s: S.wrap },
        { v: r.note || '', s: S.wrap }
      ], Math.max(16, 13 * Math.ceil(Math.max(String(r.name).length / 34, String(r.desc || '').length / 52))));
    });

    const ws = sheet(rows, [11, 40, 20, 18, 8, 12, 18, 54, 22], merges, 7, 'Materials Database');

    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Materials database</dc:title><dc:creator>Quick Quantity</dc:creator>
<cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Materials Database" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', ws);
    return zip.build();
  }


  /* ------------------------------------------------------ bending schedule */
  /* One row per bar mark, banded by member, with the steel added up by
     diameter at the foot — the sheet a cutting list is worked from. */
  function buildBBS(rows, meta) {
    meta = meta || {};
    const C = meta.currency || 'GH\u00a2';
    const out = [], merges = [];
    const push = (cells, h) => { out.push({ cells, h }); return out.length; };
    const blank = () => push([{ v: '' }]);

    push([{ v: 'BAR BENDING SCHEDULE', s: S.title }], 26); merges.push('A1:K1');
    push([{ v: meta.project || 'Project', s: S.sub }], 18); merges.push('A2:K2');
    push([{ v: 'Date: ' + (meta.date || '') + '   \u00b7   Cut length = legs less 2d per bend, plus hooks and laps   \u00b7   weight = length \u00d7 d\u00b2/162.28 kg/m', s: S.wrap }], 20);
    merges.push(`A${out.length}:K${out.length}`);
    blank();

    push([{ v: 'Mark', s: S.hdr }, { v: 'Member', s: S.hdr }, { v: 'Description / location', s: S.hdr },
          { v: 'Bar', s: S.hdr }, { v: 'Shape', s: S.hdr }, { v: 'No. per member', s: S.hdr },
          { v: 'Members', s: S.hdr }, { v: 'Bars', s: S.hdr }, { v: 'Cut (mm)', s: S.hdr },
          { v: 'Length (m)', s: S.hdr }, { v: 'Weight (kg)', s: S.hdr }], 26);

    let last = null;
    (rows || []).forEach(r => {
      if (r.member !== last) {
        last = r.member;
        const list = rows.filter(x => x.member === r.member);
        push([{ v: String(r.member).toUpperCase() + '   \u00b7   ' + list.length + ' mark' + (list.length === 1 ? '' : 's'), s: S.totalLbl },
              { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
              { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
              { v: 'Subtotal', s: S.totalLbl },
              { v: Math.round(list.reduce((n, x) => n + x.kg, 0) * 100) / 100, s: S.total }], 18);
      }
      const shape = r.type === 'mesh' ? 'Mesh'
        : ((typeof BBS !== 'undefined' && BBS.SHAPES && BBS.SHAPES[r.shape]) ? BBS.SHAPES[r.shape].short : 'Bar');
      push([
        { v: r.mark, s: S.center },
        { v: r.member, s: S.wrap },
        { v: r.loc || '', s: S.wrap },
        { v: r.type === 'mesh' ? r.spec : 'Y' + r.dia, s: S.center },
        { v: shape, s: S.center },
        { v: r.type === 'mesh' ? '' : r.no, s: S.center },
        { v: r.type === 'mesh' ? '' : r.members, s: S.center },
        { v: r.type === 'mesh' ? '' : r.bars, s: S.center },
        { v: r.type === 'mesh' ? '' : r.cut, s: S.qty },
        { v: r.type === 'mesh' ? Math.round(r.area * 10) / 10 : Math.round(r.metres * 100) / 100, s: S.qty },
        { v: Math.round(r.kg * 100) / 100, s: S.money }
      ], Math.max(16, 13 * Math.ceil(String(r.loc || '').length / 40)));
    });

    const t = meta.totals || { kg: 0 };
    push([{ v: 'TOTAL STEEL', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: '', s: S.totalLbl }, { v: t.kg, s: S.total }], 20);

    blank();
    push([{ v: 'By diameter', s: S.bold }]);
    push([{ v: 'Bar', s: S.hdr }, { v: 'Marks', s: S.hdr }, { v: 'Bars', s: S.hdr }, { v: 'Length (m)', s: S.hdr }, { v: 'Weight (kg)', s: S.hdr }], 18);
    (meta.byDia || []).forEach(d => push([{ v: d.label, s: S.center }, { v: d.marks, s: S.center },
      { v: d.dia ? d.bars : '', s: S.center }, { v: d.dia ? Math.round(d.metres * 100) / 100 : '', s: S.qty },
      { v: Math.round(d.kg * 100) / 100, s: S.money }]));
    blank();
    push([{ v: 'The bill carries ' + ((meta.bill && meta.bill.kg) || 0) + ' kg of reinforcement; this schedule '
      + (meta.totals ? Math.round(meta.totals.kg * 100) / 100 : 0) + ' kg (' + (meta.variance > 0 ? '+' : '')
      + (meta.variance == null ? '' : Math.round(meta.variance * 100) / 100) + ' kg against it).', s: S.wrap }], 30);
    merges.push(`A${out.length}:K${out.length}`);

    const ws = sheet(out, [9, 16, 38, 8, 9, 10, 9, 8, 10, 10, 13], merges, 5, 'Bending Schedule');

    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Bar bending schedule - ${esc(meta.project || 'Project')}</dc:title><dc:creator>Quick Quantity</dc:creator>
<cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Bending Schedule" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', ws);
    return zip.build();
  }


  /* -------------------------------------------------------------- labour */
  /* The labour schedule as a workbook: one row per trade with the days,
     hours, day rate and cost the bill carries, then the same days bill by
     bill, so a site can work either way. */
  function buildLabour(lab) {
    const C = String(lab.currency || 'GH\u00a2').trim();
    const rows = [], merges = [];
    const push = (cells, h) => { rows.push({ cells, h }); return rows.length; };
    const blank = () => push([{ v: '' }]);
    const money = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const num = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
      { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const t = lab.totals;

    push([{ v: 'LABOUR SCHEDULE', s: S.title }], 26); merges.push('A1:H1');
    push([{ v: lab.projectName || 'Project', s: S.sub }], 18); merges.push('A2:H2');
    if (lab.projectSub) { push([{ v: lab.projectSub, s: S.normal }]); merges.push(`A${rows.length}:H${rows.length}`); }
    if (lab.location) { push([{ v: lab.location, s: S.normal }]); merges.push(`A${rows.length}:H${rows.length}`); }
    push([{ v: 'Currency: ' + C + '   \u00b7   Date: ' + lab.date + '   \u00b7   '
      + t.hoursADay + '-hour day, 5-day week   \u00b7   programme ' + t.period + ' weeks ('
      + t.workDays + ' working days)', s: S.wrap }], 20);
    merges.push(`A${rows.length}:H${rows.length}`);
    push([{ v: t.trades + ' trades   \u00b7   ' + num(t.days) + ' man-days   \u00b7   ' + num(t.hours)
      + ' hours   \u00b7   labour cost ' + C + ' ' + money(t.cost)
      + '   \u00b7   crew ' + num(t.crew) + ' men', s: S.bold }], 20);
    merges.push(`A${rows.length}:H${rows.length}`);
    if (t.assessedCost > 0) {
      push([{ v: 'A further ' + C + ' ' + money(t.assessedCost) + ' of labour sits inside '
        + t.assessedOnly + ' assessed rates (doors, fittings, services): money with no measured time, '
        + 'so it is reported apart and not turned into days.', s: S.wrap }], 28);
      merges.push(`A${rows.length}:H${rows.length}`);
    }
    blank();

    push([{ v: 'Trade', s: S.hdr }, { v: 'Work the trade does', s: S.hdr }, { v: 'Man-days', s: S.hdr },
          { v: 'Hours', s: S.hdr }, { v: 'Day rate (' + C + ')', s: S.hdr },
          { v: 'Labour cost (' + C + ')', s: S.hdr }, { v: 'Crew', s: S.hdr },
          { v: 'Share', s: S.hdr }], 26);

    (lab.trades || []).forEach(tr => {
      push([
        { v: tr.label, s: S.bold },
        { v: tr.blurb || '', s: S.wrap },
        { v: tr.days, s: S.qty },
        { v: tr.hours, s: S.qty },
        { v: tr.rate, s: S.money },
        { v: tr.cost, s: S.money },
        { v: tr.men, s: S.qty },
        { v: t.days ? tr.days / t.days : 0, s: S.qty }
      ], 16);
    });

    push([{ v: 'TOTAL LABOUR COST', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: t.days, s: S.total }, { v: t.hours, s: S.total }, { v: '', s: S.total },
          { v: t.cost, s: S.total }, { v: t.crew, s: S.total }, { v: 1, s: S.total }], 20);

    if (t.assessedCost > 0) {
      push([{ v: 'Assessed labour \u2014 a labour-and-plant share inside assessed rates, no trade and no time named',
        s: S.wrap }, { v: '', s: S.wrap }, { v: '\u2014', s: S.center }, { v: '\u2014', s: S.center },
        { v: '\u2014', s: S.center }, { v: t.assessedCost, s: S.money }, { v: '\u2014', s: S.center },
        { v: '', s: S.center }], 26);
      push([{ v: 'LABOUR VALUE CARRIED BY THE BILL', s: S.totalLbl }, { v: '', s: S.totalLbl },
            { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
            { v: t.labourValue, s: S.total }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl }], 20);
    }

    blank();
    push([{ v: 'THE SAME LABOUR, BILL BY BILL', s: S.hdr }], 20); merges.push(`A${rows.length}:H${rows.length}`);
    push([{ v: 'Bill', s: S.hdr }, { v: 'Description', s: S.hdr }, { v: 'Trades used', s: S.hdr },
          { v: 'Man-days', s: S.hdr }, { v: 'Labour cost (' + C + ')', s: S.hdr },
          { v: 'Assessed (' + C + ')', s: S.hdr }], 26);

    (lab.bills || []).forEach(b => {
      push([
        { v: String(b.code || '').replace(/BILL\s*No\.?\s*/i, 'B'), s: S.center },
        { v: b.title || '', s: S.wrap },
        { v: b.trades.length ? b.trades.map(x => x.label + ' ' + num(x.days) + ' days').join('  \u00b7  ') : '\u2014', s: S.wrap },
        { v: b.days, s: S.qty },
        { v: b.cost, s: S.money },
        { v: b.assessed || '', s: S.money }
      ], Math.max(16, 13 * Math.ceil(String(b.title || '').length / 44)));
    });

    push([{ v: 'TOTAL', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: t.days, s: S.total }, { v: t.cost, s: S.total }, { v: t.assessedCost, s: S.total }], 20);

    blank();
    const note = 'Every line is multiplied out of a priced bill item: the rate build-up says how much of each trade '
      + 'a unit of work takes (a mason for 0.16 day per square metre of wall), and the schedule multiplies that by the '
      + 'quantity in the bill and prices it at the day rate in the rate card. A corrected quantity, a changed rate or a '
      + 'changed day rate moves it. Crew is the man-days divided by the working days in the programme, so a trade needed '
      + 'for a few days reads as a fraction of a man: share it, or bring it in for that week.';
    push([{ v: note, s: S.wrap }], 54);
    merges.push(`A${rows.length}:H${rows.length}`);

    const ws = sheet(rows, [30, 44, 12, 11, 14, 16, 10, 10], merges, 8, 'Labour Schedule');
    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Labour Schedule - ${esc(lab.projectName || 'Project')}</dc:title><dc:creator>Quick Quantity</dc:creator>
<cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Labour Schedule" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', ws);
    return zip.build();
  }


  /* ------------------------------------------------------- cost breakdown */
  /* The bill read as money: the heads it is made of, then the same money
     bill by bill, with the columns a spreadsheet can be sorted on. */
  function buildCostBreak(cb) {
    const C = String(cb.currency || 'GH\u00a2').trim();
    const rows = [], merges = [];
    const push = (cells, h) => { rows.push({ cells, h }); return rows.length; };
    const blank = () => push([{ v: '' }]);
    const money = n => (isFinite(n) ? Number(n) : 0).toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const t = cb.totals;

    push([{ v: 'COST BREAKDOWN', s: S.title }], 26); merges.push('A1:J1');
    push([{ v: cb.projectName || 'Project', s: S.sub }], 18); merges.push('A2:J2');
    if (cb.projectSub) { push([{ v: cb.projectSub, s: S.normal }]); merges.push(`A${rows.length}:J${rows.length}`); }
    if (cb.location) { push([{ v: cb.location, s: S.normal }]); merges.push(`A${rows.length}:J${rows.length}`); }
    push([{ v: 'Currency: ' + C + '   \u00b7   Date: ' + cb.date + '   \u00b7   ' + t.bills + ' bills   \u00b7   '
      + money(t.GFA) + ' m\u00b2   \u00b7   ' + C + ' ' + money(t.perM2) + ' per m\u00b2', s: S.wrap }], 20);
    merges.push(`A${rows.length}:J${rows.length}`);
    push([{ v: 'Contract sum ' + C + ' ' + money(t.grand) + '  =  bills ' + C + ' ' + money(t.subtotal)
      + '  +  contingency ' + C + ' ' + money(t.contingency), s: S.bold }], 20);
    merges.push(`A${rows.length}:J${rows.length}`);
    blank();

    push([{ v: 'WHERE THE MONEY GOES', s: S.hdr }], 20); merges.push(`A${rows.length}:J${rows.length}`);
    push([{ v: 'Cost head', s: S.hdr }, { v: 'What it covers', s: S.hdr }, { v: 'Amount (' + C + ')', s: S.hdr },
          { v: '% of contract sum', s: S.hdr }, { v: C + ' per m\u00b2', s: S.hdr }], 26);
    (cb.heads || []).forEach(h => {
      push([{ v: h.label, s: S.bold }, { v: h.blurb || '', s: S.wrap },
            { v: h.amount, s: S.money }, { v: h.pct / 100, s: S.pct },
            { v: t.GFA > 0 ? h.perM2 : '', s: S.money }], 16);
    });
    push([{ v: 'CONTRACT SUM', s: S.totalLbl }, { v: '', s: S.totalLbl }, { v: t.grand, s: S.total },
          { v: 1, s: S.pctTotal }, { v: t.perM2, s: S.total }], 20);
    blank();

    push([{ v: 'EVERY BILL, BROKEN DOWN', s: S.hdr }], 20); merges.push(`A${rows.length}:J${rows.length}`);
    push([{ v: 'Bill', s: S.hdr }, { v: 'Description', s: S.hdr }, { v: 'Materials (' + C + ')', s: S.hdr },
          { v: 'Labour (' + C + ')', s: S.hdr }, { v: 'Plant (' + C + ')', s: S.hdr },
          { v: 'Sundries (' + C + ')', s: S.hdr }, { v: 'Overheads & profit (' + C + ')', s: S.hdr },
          { v: 'Amount (' + C + ')', s: S.hdr }, { v: '% of sum', s: S.hdr }, { v: 'Per m\u00b2', s: S.hdr }], 30);
    (cb.bills || []).forEach(b => {
      push([{ v: String(b.code || '').replace(/BILL\s*No\.?\s*/i, 'B'), s: S.center },
            { v: b.title || '', s: S.wrap },
            { v: b.heads.materials, s: S.money }, { v: b.heads.labour, s: S.money },
            { v: b.heads.plant, s: S.money }, { v: b.heads.sundry, s: S.money },
            { v: b.heads.overheads, s: S.money }, { v: b.amount, s: S.money },
            { v: b.pct / 100, s: S.pct }, { v: t.GFA > 0 ? b.perM2 : '', s: S.money }],
        Math.max(16, 13 * Math.ceil(String(b.title || '').length / 42)));
    });
    push([{ v: 'TOTAL', s: S.totalLbl }, { v: '', s: S.totalLbl },
          { v: t.materials, s: S.total }, { v: t.labour, s: S.total }, { v: t.plant, s: S.total },
          { v: t.sundry, s: S.total }, { v: t.overheads, s: S.total }, { v: t.subtotal, s: S.total },
          { v: t.subtotal / (t.grand || 1), s: S.pctTotal }, { v: t.GFA > 0 ? t.subtotal / t.GFA : '', s: S.total }], 20);
    blank();
    const note = 'Each rate in the build-up is made of materials, labour, plant, sundries and an overheads-and-profit '
      + 'uplift; each assessed rate is split into its supply and fix shares. Multiplying those shares by the money the '
      + 'bill charges gives this workbook, and the heads add up to the contract sum to the cent. A corrected quantity, '
      + 'a changed rate or a changed day rate moves it. Where the Labour Schedule prices the measured days at the day '
      + 'rates in the card it may differ from the labour column here by the amount the billed rates sit away from their build-ups.';
    push([{ v: note, s: S.wrap }], 56);
    merges.push(`A${rows.length}:J${rows.length}`);

    const ws = sheet(rows, [26, 46, 15, 15, 13, 14, 17, 16, 10, 11], merges, 0, 'Cost Breakdown');
    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/package/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Cost Breakdown - ${esc(cb.projectName || 'Project')}</dc:title><dc:creator>Quick Quantity</dc:creator>
<cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Cost Breakdown" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
    zip.add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add('xl/styles.xml', STYLES);
    zip.add('xl/worksheets/sheet1.xml', ws);
    return zip.build();
  }


  root.XlsxWriter = { build, buildMaterials, buildCatalogue, buildBBS, buildLabour, buildCostBreak };
})(typeof window !== 'undefined' ? window : globalThis);
