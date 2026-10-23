/* =====================================================================
   DOCX WRITER — builds a real Word document from the BOQ result.
   Cover · preambles · 13 priced bills · summary · signatures
   ===================================================================== */
(function (root) {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  const GREEN = '1F4E3D', GREEN_HDR = '2E6B55', GREEN_L = 'E3EEE8', GREY = '666666', LINE = 'BFBFBF';

  /* -------- run / paragraph helpers -------- */
  function run(text, o) {
    o = o || {};
    const rpr = [];
    if (o.font !== false) rpr.push('<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>');
    if (o.bold) rpr.push('<w:b/>');
    if (o.italic) rpr.push('<w:i/>');
    if (o.color) rpr.push(`<w:color w:val="${o.color}"/>`);
    if (o.size) rpr.push(`<w:sz w:val="${Math.round(o.size * 2)}"/><w:szCs w:val="${Math.round(o.size * 2)}"/>`);
    const props = rpr.length ? `<w:rPr>${rpr.join('')}</w:rPr>` : '';
    return `<w:r>${props}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }

  function p(text, o) {
    o = o || {};
    const pr = [];
    if (o.keepNext) pr.push('<w:keepNext/>');
    if (o.border) pr.push(`<w:pBdr><w:bottom w:val="single" w:sz="${o.border.size || 8}" w:space="2" w:color="${o.border.color || GREEN}"/></w:pBdr>`);
    if (o.fill) pr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>`);
    pr.push(`<w:spacing w:before="${Math.round((o.before || 0) * 20)}" w:after="${Math.round((o.after || 0) * 20)}" w:line="${o.line || 240}" w:lineRule="auto"/>`);
    if (o.indent) pr.push(`<w:ind w:left="${o.indent}" w:hanging="284"/>`);
    if (o.align) pr.push(`<w:jc w:val="${o.align}"/>`);
    const body = Array.isArray(text) ? text.map(t => typeof t === 'string' ? run(t, o) : run(t.text, Object.assign({}, o, t))).join('') : run(text, o);
    return `<w:p><w:pPr>${pr.join('')}</w:pPr>${body}</w:p>`;
  }

  function bullet(text) {
    return `<w:p><w:pPr><w:spacing w:before="20" w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:left="284" w:hanging="284"/><w:rPr><w:sz w:val="17"/></w:rPr></w:pPr>${run('•\u2003', { size: 8.5 })}${run(text, { size: 8.5 })}</w:p>`;
  }

  /* -------- table helpers -------- */
  function cell(content, o) {
    o = o || {};
    const w = o.w || 1000;
    const pr = [`<w:tcW w:w="${w}" w:type="dxa"/>`];
    if (o.span) pr.push(`<w:gridSpan w:val="${o.span}"/>`);
    if (o.fill) pr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>`);
    if (o.valign) pr.push(`<w:vAlign w:val="${o.valign}"/>`);
    const para = p(content, {
      size: o.size || 8.5, bold: o.bold, color: o.color, align: o.align,
      before: o.before == null ? 1 : o.before, after: o.after == null ? 1 : o.after
    });
    return `<w:tc><w:tcPr>${pr.join('')}</w:tcPr>${para}</w:tc>`;
  }

  function table(rowsXml, widths, o) {
    o = o || {};
    const total = widths.reduce((a, b) => a + b, 0);
    const borders = o.borders === false ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      : `<w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="${o.borderColor || LINE}"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="${o.borderColor || LINE}"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${o.borderColor || LINE}"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="${o.borderColor || LINE}"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${o.borderColor || LINE}"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${o.borderColor || LINE}"/>
        </w:tblBorders>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="left"/>${borders}<w:tblLayout w:type="fixed"/>
      <w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>
      <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>
      <w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rowsXml}</w:tbl>`;
  }

  const tr = (cells, o) => {
    o = o || {};
    const pr = [];
    if (o.header) pr.push('<w:cantSplit/><w:tblHeader/>'); else pr.push('<w:cantSplit/>');
    return `<w:tr><w:trPr>${pr.join('')}</w:trPr>${cells}</w:tr>`;
  };

  const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qty = (n, u) => Number(n || 0).toLocaleString('en-US', u === 'm3'
    ? { minimumFractionDigits: 3, maximumFractionDigits: 3 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  /* -------- document -------- */
  function build(result) {
    const r = result, p_ = r.params;
    const C = p_.curSymbol || 'GH¢';
    const CW = 9866;                     // usable width in twips (A4, 18 mm margins)
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const body = [];

    /* ---- cover ---- */
    body.push(p('REPUBLIC OF GHANA', { size: 9.5, bold: true, color: GREEN, align: 'center', before: 0, after: 10 }));
    body.push(p('', { border: { size: 12 }, after: 16 }));
    body.push(p(p_.projectName.toUpperCase(), { size: 20, bold: true, align: 'center', after: 4 }));
    body.push(p(p_.projectSub, { size: 12, color: GREEN, align: 'center', after: 4 }));
    body.push(p(p_.location, { size: 9.5, color: GREY, align: 'center', after: 14 }));

    body.push(table(tr(cell('BILL OF QUANTITIES', { w: CW, fill: GREEN, color: 'FFFFFF', bold: true, size: 14, align: 'center', before: 4, after: 4 })), [CW], { borderColor: GREEN }));

    body.push(p('', { after: 8 }));
    body.push(p('PROJECT PARTICULARS', { size: 10, bold: true, color: GREEN, before: 6, after: 4, keepNext: true }));
    const line = (label, val) => [label, val || '_________________________________________'];
    const party = [];
    party.push(line('Client / Employer', p_.client));
    if (p_.clientAddr) party.push(['Client address', p_.clientAddr]);
    party.push(line('Consultant / Quantity Surveyor', p_.consultant));
    if (p_.preparedBy) party.push(['Prepared by', p_.preparedBy + (p_.preparedByRole ? ' — ' + p_.preparedByRole : '')]);
    if (p_.consultantAddr) party.push(['Consultant address', p_.consultantAddr]);
    party.push(line('Contractor (tenderer)', p_.contractor));
    if (p_.contractorAddr) party.push(['Contractor address', p_.contractorAddr]);
    if (p_.contractorClass) party.push(['Contractor class / registration', p_.contractorClass]);
    if (p_.tenderRef) party.push(['Tender reference', p_.tenderRef]);
    if (p_.contractPeriod) party.push(['Contract period', p_.contractPeriod]);
    const partRows = party.concat([
      ['Drawing reference', 'Uploaded plan image' + (p_.drawingRef ? ' — ' + p_.drawingRef : '')],
      ['Basis of measurement', 'Ghana Standard Method of Measurement of Building Works (GSMMBW)'],
      ['Currency', (p_.curLabel || 'Ghana Cedi') + ' (' + C.trim() + ')'],
      ['Date of bill', p_.billDate || dateStr],
      ['Gross floor area', r.GFA.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²'],
      ['Price basis', p_.priceNote || 'Q4 2026 Greater Accra market rates']
    ]).map(([a, b]) => tr(
      cell(a, { w: 2700, bold: true, color: GREEN, size: 8.5 }) +
      cell(b, { w: CW - 2700, size: 8.5 }))).join('');
    body.push(table(partRows, [2700, CW - 2700], { borders: false }));

    body.push(p('Prepared from a plan picture with Quick Quantity. Quantities measured from the building model; rates editable. '
      + 'Verify the scale, foundation depth and current supplier prices before issuing for tender.',
      { size: 8, italic: true, color: GREY, before: 10, after: 0 }));

    /* ---- preambles ---- */
    body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>');

    body.push(p('PREAMBLES AND BASIS OF THE BILL', { size: 12, bold: true, color: GREEN, after: 6, keepNext: true }));
    body.push(p('This Bill of Quantities has been measured in accordance with the Ghana Standard Method of Measurement of Building '
      + 'Works and describes the works measured from the uploaded drawing. The quantities are given as accurately as circumstances '
      + 'permit but are not guaranteed; the Contractor is deemed to have satisfied himself as to the site conditions and the means '
      + 'of access. Rates are to be full inclusive rates covering labour, materials, plant, transport, overheads, profit and all '
      + 'obligations under the Conditions of Contract.', { size: 8.8, after: 6, align: 'both' }));
    body.push(p('The Contractor is required to price every item. Items left unpriced will be deemed covered by the other rates in '
      + 'the Bill. The Bill is not to be altered; corrections are to be made in ink, initialled and dated.', { size: 8.8, after: 10, align: 'both' }));

    body.push(p('SUMMARY OF THE PROPOSED ACCOMMODATION', { size: 10, bold: true, after: 4, keepNext: true }));
    const accRows = [tr(
      cell('Accommodation', { w: 5000, bold: true, size: 8.5, fill: GREEN_L, align: 'center' }) +
      cell('Length (m)', { w: 1300, bold: true, size: 8.5, fill: GREEN_L, align: 'center' }) +
      cell('Width (m)', { w: 1300, bold: true, size: 8.5, fill: GREEN_L, align: 'center' }) +
      cell('Area (m²)', { w: CW - 7600, bold: true, size: 8.5, fill: GREEN_L, align: 'center' }), { header: true })];
    r.rooms.forEach(rm => {
      accRows.push(tr(
        cell(rm.name, { w: 5000, size: 8.5, align: 'center' }) +
        cell(rm.L.toFixed(2), { w: 1300, size: 8.5, align: 'center' }) +
        cell(rm.W.toFixed(2), { w: 1300, size: 8.5, align: 'center' }) +
        cell((rm.L * rm.W).toFixed(2), { w: CW - 7600, size: 8.5, align: 'right' })));
    });
    accRows.push(tr(
      cell('GROSS FLOOR AREA', { w: 5000, bold: true, size: 8.5, fill: GREEN_L, align: 'center' }) +
      cell('', { w: 1300, fill: GREEN_L }) + cell('', { w: 1300, fill: GREEN_L }) +
      cell(r.GFA.toFixed(2), { w: CW - 7600, bold: true, size: 8.5, fill: GREEN_L, align: 'right' })));
    body.push(table(accRows, [5000, 1300, 1300, CW - 7600]));

    body.push(p('BASIS OF THE QUANTITIES', { size: 10, bold: true, before: 12, after: 4, keepNext: true }));
    const m = r.model;
    [
      'All walls are taken as ' + Math.round(m.p.wallT * 1000) + ' mm thick sandcrete blockwork.',
      'Foundations taken to ' + m.p.foundDepth.toFixed(2) + ' m below ground floor level on firm laterite/gravel; no rock excavation allowed for.',
      'Roof at ' + m.p.roofPitch + '° pitch with ' + Math.round(m.p.overhang * 1000) + ' mm eaves overhang, aluminium long-span sheets.',
      'Blockwork ' + m.blockTotal.toFixed(2) + ' m² (≈ ' + Math.round(m.blocks).toLocaleString() + ' blocks at 9.7/m² — a 450 × 225 mm block with 10 mm joints and 5% waste).',
      'Concrete ' + m.concTotal.toFixed(2) + ' m³ with ' + Math.round(m.rebar).toLocaleString() + ' kg of reinforcement (90 kg/m³).',
      'Internal plaster ' + m.plasterInt.toFixed(2) + ' m²; external render ' + m.renderExt.toFixed(2) + ' m².',
      'Excluded: furniture and teaching equipment, external electrical reticulation, access roads, boundary wall and land costs.'
    ].forEach(t => body.push(bullet(t)));

    /* ---- the bills ---- */
    body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>');
    body.push(p('BILL OF QUANTITIES', { size: 12, bold: true, color: GREEN, after: 8, keepNext: true }));

    const W = [620, 4600, 700, 1100, 1300, CW - 8320];
    r.bills.forEach(b => {
      body.push(table(tr(cell(b.code + ':  ' + b.title, { w: CW, fill: GREEN, color: 'FFFFFF', bold: true, size: 10.5, before: 3, after: 3 })), [CW], { borderColor: GREEN }));
      const rows = [tr(
        cell('Item', { w: W[0], bold: true, size: 8, color: 'FFFFFF', fill: GREEN_HDR, align: 'center' }) +
        cell('Description of work', { w: W[1], bold: true, size: 8, color: 'FFFFFF', fill: GREEN_HDR, align: 'center' }) +
        cell('Unit', { w: W[2], bold: true, size: 8, color: 'FFFFFF', fill: GREEN_HDR, align: 'center' }) +
        cell('Qty', { w: W[3], bold: true, size: 8, color: 'FFFFFF', fill: GREEN_HDR, align: 'center' }) +
        cell('Rate (' + C.trim() + ')', { w: W[4], bold: true, size: 8, color: 'FFFFFF', fill: GREEN_HDR, align: 'center' }) +
        cell('Amount (' + C.trim() + ')', { w: W[5], bold: true, size: 8, color: 'FFFFFF', fill: GREEN_HDR, align: 'center' }), { header: true })];
      b.items.forEach((it, i) => {
        rows.push(tr(
          cell(String(i + 1).padStart(2, '0'), { w: W[0], size: 8, align: 'center' }) +
          cell(it.desc, { w: W[1], size: 8 }) +
          cell(it.unit, { w: W[2], size: 8, align: 'center' }) +
          cell(qty(it.qty, it.unit), { w: W[3], size: 8, align: 'right' }) +
          cell(money(it.rate), { w: W[4], size: 8, align: 'right' }) +
          cell(money(it.amount), { w: W[5], size: 8, align: 'right' })));
      });
      rows.push(tr(
        cell('', { w: W[0], fill: GREEN_L, size: 8 }) +
        cell('Total carried to Summary — ' + b.code, { w: W[1], bold: true, size: 8, fill: GREEN_L, align: 'right' }) +
        cell('', { w: W[2], fill: GREEN_L, size: 8 }) +
        cell('', { w: W[3], fill: GREEN_L, size: 8 }) +
        cell('', { w: W[4], fill: GREEN_L, size: 8 }) +
        cell(money(b.total), { w: W[5], bold: true, size: 8, fill: GREEN_L, align: 'right' })));
      body.push(table(rows, W));
      body.push(p('', { after: 6 }));
    });

    /* ---- summary ---- */
    body.push('<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>');
    body.push(p('SUMMARY OF BILLS', { size: 12, bold: true, color: GREEN, after: 8, keepNext: true }));

    const SW = [700, 6500, CW - 7200];
    const sRows = [tr(
      cell('Bill', { w: SW[0], bold: true, size: 8.5, fill: GREEN_L, align: 'center' }) +
      cell('Description', { w: SW[1], bold: true, size: 8.5, fill: GREEN_L, align: 'center' }) +
      cell('Amount (' + C.trim() + ')', { w: SW[2], bold: true, size: 8.5, fill: GREEN_L, align: 'right' }), { header: true })];
    r.bills.forEach(b => sRows.push(tr(
      cell(b.code.replace('BILL No. ', ''), { w: SW[0], size: 8.5, align: 'center' }) +
      cell(b.title, { w: SW[1], size: 8.5 }) +
      cell(money(b.total), { w: SW[2], size: 8.5, align: 'right' }))));
    sRows.push(tr(
      cell('', { w: SW[0], size: 8.5, fill: GREEN_L }) +
      cell('SUB-TOTAL OF BILLS 1 TO ' + r.bills.length, { w: SW[1], bold: true, size: 8.5, fill: GREEN_L, align: 'right' }) +
      cell(money(r.subtotal), { w: SW[2], bold: true, size: 8.5, fill: GREEN_L, align: 'right' })));
    sRows.push(tr(
      cell('', { w: SW[0], size: 8.5 }) +
      cell('Add: contingency allowance at ' + r.params.contingency + '%', { w: SW[1], size: 8.5, align: 'right' }) +
      cell(money(r.contingency), { w: SW[2], size: 8.5, align: 'right' })));
    body.push(table(sRows, SW));

    body.push(p('', { after: 8 }));
    body.push(table(tr(
      cell('GRAND TOTAL', { w: 5200, fill: GREEN, color: 'FFFFFF', bold: true, size: 13, before: 6, after: 6 }) +
      cell(C + money(r.grand), { w: CW - 5200, fill: GREEN, color: 'FFFFFF', bold: true, size: 13, align: 'right', before: 6, after: 6 })
    ), [5200, CW - 5200], { borderColor: GREEN }));

    body.push(p('Amount in words: ' + words(r.grand, p_) + ' Only', { size: 8.8, before: 8, after: 6 }));
    body.push(p('The grand total of ' + C + money(r.grand) + ' represents an average of ' + C + money(r.perM2)
      + ' per square metre of gross floor area of ' + r.GFA.toFixed(2) + ' m².', { size: 8.8, after: 18, align: 'both' }));

    [['For the Client / Employer', p_.client], ['For the Consultant (Quantity Surveyor)', p_.consultant],
      ['Accepted for the Contractor (tenderer)', p_.contractor]].forEach(([label, who]) => {
      body.push(p(label + (who ? ' — ' + who : ''), { size: 8.8, bold: true, before: 10, after: 4 }));
      ['Name: ..................................................................................................................',
        'Signature & stamp: ..........................................................................................',
        'Date: ..................................................................................................................']
        .forEach(t => body.push(p(t, { size: 8.8, after: 2 })));
    });

    const sectPr = `<w:sectPr>
      <w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1020" w:bottom="1020" w:left="1020" w:header="567" w:footer="454" w:gutter="0"/>
      <w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body.join('')}${sectPr}</w:body></w:document>`;

    const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

    const HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="1F4E3D"/></w:pBdr>
<w:tabs><w:tab w:val="right" w:pos="9866"/></w:tabs><w:spacing w:after="0"/></w:pPr>
${run('BILL OF QUANTITIES', { size: 7, bold: true, color: GREEN })}<w:r><w:tab/></w:r>${run(p_.projectName + '  |  ' + p_.location, { size: 7, color: GREY })}</w:p></w:hdr>`;

    const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9866"/></w:tabs><w:spacing w:after="0"/></w:pPr>
${run('Measured from the uploaded plan  ·  Ghana Standard Method of Measurement', { size: 6.8, color: GREY })}<w:r><w:tab/></w:r>${run('Page ', { size: 6.8, color: GREY })}<w:fldSimple w:instr=" PAGE ">${run('1', { size: 6.8, color: GREY })}</w:fldSimple>${run(' of ', { size: 6.8, color: GREY })}<w:fldSimple w:instr=" NUMPAGES ">${run('1', { size: 6.8, color: GREY })}</w:fldSimple></w:p></w:ftr>`;

    const zip = new root.ZipWriter();
    zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
    zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
    zip.add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Bill of Quantities - ${esc(p_.projectName)}</dc:title><dc:creator>Quick Quantity</dc:creator><cp:lastModifiedBy>Quick Quantity</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
    zip.add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Quick Quantity</Application></Properties>`);
    zip.add('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`);
    zip.add('word/document.xml', documentXml);
    zip.add('word/styles.xml', STYLES);
    zip.add('word/header1.xml', HEADER);
    zip.add('word/footer1.xml', FOOTER);
    return zip.build();
  }

  root.DocxWriter = { build };
})(typeof window !== 'undefined' ? window : globalThis);
