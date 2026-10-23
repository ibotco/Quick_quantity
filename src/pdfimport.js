/* =====================================================================
   PDF IMPORT — turn the first page (or a chosen page) of a PDF drawing
   into a bitmap the plan reader can analyse.  Uses the bundled pdf.js
   (Apache-2.0, Mozilla) with its worker inlined, so it still works with
   no network at all.
   ===================================================================== */
(function (root) {
  'use strict';

  let libReady = null;

  function lib() {
    if (libReady) return libReady;
    libReady = new Promise((resolve, reject) => {
      const L = root.pdfjsLib;
      if (!L) { reject(new Error('PDF library not available')); return; }
      try {
        // the worker source is embedded in the page as a string; hand it to
        // pdf.js through a blob URL so no separate file is ever requested
        if (!L.GlobalWorkerOptions.workerSrc && root.__PDF_WORKER_SRC) {
          const blob = new Blob([root.__PDF_WORKER_SRC], { type: 'application/javascript' });
          L.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
        }
      } catch (e) { /* fall back to the fake worker */ }
      resolve(L);
    });
    return libReady;
  }

  const isPdf = f => !!f && (/pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name || ''));

  async function open(file) {
    const L = await lib();
    const buf = await file.arrayBuffer();
    return L.getDocument({
      data: new Uint8Array(buf),
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: false
    }).promise;
  }

  async function render(doc, pageNo, maxDim) {
    const n = Math.min(Math.max(1, pageNo || 1), doc.numPages);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const longest = Math.max(base.width, base.height);
    const scale = Math.min(4, Math.max(1, (maxDim || 2200) / longest));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, background: 'rgba(255,255,255,1)' }).promise;
    let dataUrl = canvas.toDataURL('image/png');
    // a heavy raster page can overflow localStorage — re-encode as JPEG
    if (dataUrl.length > 2600000) dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return { dataUrl, width: canvas.width, height: canvas.height, page: n, pages: doc.numPages };
  }

  /* ----------------------------------------------------------------
     SHEETS — a PDF issued as one file often holds the floor plan, the
     foundation plan, sections, elevations and details. Read the text of
     every page and work out what each sheet is.
     ---------------------------------------------------------------- */
  const KINDS = [
    { id: 'foundation', label: 'Foundation plan', re: /(foundation|footing|substructure|pad\s+foundation|raft\s+foundation)[^,.;]{0,20}(plan|layout|details?|schedule)/i },
    { id: 'floor', label: 'Floor plan', re: /((ground|first|second|third|typical|upper|lower)\s+floor\s+plan)|floor\s+plan|building\s+plan/i },
    { id: 'roof', label: 'Roof plan', re: /roof\s+(plan|layout|framing)/i },
    { id: 'section', label: 'Section', re: /(section\s*[A-Z0-9][A-Z0-9\-\/]*)|longitudinal\s+section|cross\s+section/i },
    { id: 'elevation', label: 'Elevation', re: /((front|rear|side|left|right|north|south|east|west)\s+elevation)|elevations?/i },
    { id: 'site', label: 'Site / location plan', re: /site\s+plan|location\s+plan|block\s+plan/i },
    { id: 'schedule', label: 'Schedule', re: /(door|window|finishes|ironmongery|room)\s+(schedule|schedule\s+of)/i },
    { id: 'detail', label: 'Detail', re: /detail(s)?\b/i }
  ];

  const TITLE_RE = {
    floor: /((ground|first|second|third|typical)\s+floor\s+plan)|(floor\s+plan)|(building\s+plan)/i,
    foundation: /(foundation|footing|substructure)\s*(plan|layout)/i,
    roof: /roof\s*(plan|layout|framing)/i,
    section: /section\s*[A-Z0-9][A-Z0-9\-\/]*/i,
    elevation: /((front|rear|side|left|right|north|south|east|west)\s+)?elevations?/i,
    site: /(site|location|block)\s+plan/i,
    schedule: /(door|window|finishes|ironmongery|room)\s+schedule/i,
    detail: /detail(s)?/i
  };

  function titleOf(text, kind) {
    const k = KINDS.find(x => x.id === kind);
    if (!k) return '';
    const m = text.match(TITLE_RE[kind] || k.re);
    if (!m) return '';
    let t = m[0].replace(/\s+/g, ' ').trim().toUpperCase();
    if (t.length > 34) {                       // never cut a word in half
      t = t.slice(0, 34);
      t = t.slice(0, Math.max(0, t.lastIndexOf(' ')));
    }
    return t;
  }

  /* the scale printed in the title block, e.g. "SCALE 1:100" */
  function scaleOf(text) {
    const m = String(text || '').match(/1\s*[:\u2236]\s*(20|25|50|75|100|125|150|200|250|500)\b/);
    return m ? Number(m[1]) : null;
  }

  const ROOMS = /(bedroom|classroom|kitchen|living|dining|store|office|corridor|toilet|wc|verandah|veranda|hall|lobby|stair|bathroom|utility)/i;

  /* A whole text item that is nothing but a room name — with an optional room
     number or a size printed on the same line, e.g. "BEDROOM 2",
     "LIVING/DINING", "KITCHEN 3.6 x 3.0". Titles such as "GROUND FLOOR PLAN"
     never match because the whole item has to be a room name. */
  const ROOM_LABEL = /^(?:(?:(?:master|guest|kids|children['\u2019]?s|boys?|girls?)\s+)?(?:bed\s*room|bedroom|bed\s*rm|b\/room|bed)|living(?:\s*(?:room|area|hall|dining))?|sitting(?:\s*room)?|lounge|dining(?:\s*(?:room|area))?|kitchen(?:ette)?|pantry|store\s*room|store|bath\s*room|bath|toilet|w\.?\s?c\.?|wash\s*room|shower(?:\s*room)?|laundry|utility(?:\s*room)?|garage|car\s*port|porch|veranda(?:h)?|balcony|terrace|hall(?:way)?|entrance\s*hall|lobby|corridor|passage(?:way)?|stair(?:s|case)?|landing|office|study|reception|shop|showroom|warehouse|class\s*room|classroom|class|laboratory|lab|library|assembly(?:\s*hall)?|kindergarten|kg|ward|consult(?:ing)?(?:\s*room)?|treatment(?:\s*room)?|dispensary|pharmacy|maternity|theatre|triage|nave|sanctuary|altar|vestry|chapel|pulpit|choir|crypt|room|(?:head\s*master['\u2019]?s?|head\s*teacher['\u2019]?s?|principal['\u2019]?s?|staff|waiting|entrance|conference|board|meeting|exam(?:ination)?|lecture|assembly|changing|prayer|plant)\s+(?:office|room|hall|store))(?:\s*[\/&+]\s*(?:bed\s*room|bedroom|living|dining|kitchen|study|office|bath\s*room|bath|toilet|wc|store))?(?:\s*[\(\-\u2013]?\s*\d{1,2}\s*[\)]?)?(?:\s*[\-\u2013:]?\s*\d+(?:[.,]\d+)?\s*(?:mm|m)?\s*[x\u00d7]\s*\d+(?:[.,]\d+)?\s*(?:mm|m)?)?$/i;

  // a title that says which floor a plan on the sheet belongs to
  const FLOOR_TITLE = /^(?:(ground|first|second|third|fourth|fifth|typical|upper|lower)\s+)?floor\s+plan$/i;

  // pull the room names off a page, with their position on the sheet, and
  // the floor titles: one sheet often carries the ground and the first floor
  // side by side, and their rooms must not be added together
  function roomLabels(items, vp) {
    const out = [], titles = [];
    (items || []).forEach(it => {
      let s = String(it.str == null ? '' : it.str).replace(/\s+/g, ' ').trim();
      if (!s || s.length < 2 || s.length > 42) return;
      s = s.replace(/^[\s\-\.:]+|[\s\-\.:]+$/g, '');
      const tr = it.transform || [];
      const x = tr.length >= 6 ? +tr[4] || 0 : 0;
      const y = tr.length >= 6 ? +tr[5] || 0 : 0;
      const u = vp.width ? x / vp.width : 0, v = vp.height ? 1 - y / vp.height : 0;
      if (FLOOR_TITLE.test(s)) { titles.push({ text: s.toUpperCase(), u: u, v: v }); return; }
      if (!ROOM_LABEL.test(s)) return;
      out.push({ text: s.toUpperCase(), u: u, v: v });
    });
    // the same label twice at the same spot is one room
    const seen = {};
    const labels = out.filter(l => {
      const k = l.text + '@' + Math.round(l.u * 400) + ',' + Math.round(l.v * 400);
      if (seen[k]) return false;
      seen[k] = 1; return true;
    }).slice(0, 40);
    return { labels: labels, titles: titles.slice(0, 8) };
  }

  function storeyOf(text) {
    if (/third\s+floor/i.test(text)) return 4;
    if (/second\s+floor/i.test(text)) return 3;
    if (/first\s+floor/i.test(text)) return 2;
    if (/ground\s+floor|floor\s+plan|building\s+plan/i.test(text)) return 1;
    return ROOMS.test(text) ? 1 : 0;   // rooms named but no storey given: ground floor
  }


  function classify(text) {
    const t = String(text || '').slice(0, 6000);
    let best = { kind: 'unknown', score: 0 };
    KINDS.forEach(k => {
      const m = t.match(k.re);
      if (!m) return;
      const n = (t.match(new RegExp(k.re.source, 'gi')) || []).length;
      let score = 3 + Math.min(3, n);
      if (k.id === 'floor' && /(bedroom|classroom|kitchen|living|dining|store|office|corridor|toilet|wc|verandah|hall)/i.test(t)) score += 2;
      if (k.id === 'foundation' && /(footing|foundation|pile|raft|strip|pad|blinding)/i.test(t)) score += 1;
      if (k.id === 'section' && /(level|rl\s*[=:]|eaves|ceiling|pitch|ground floor level)/i.test(t)) score += 1;
      if (k.id === 'elevation' && /(roof|cladding|render|window|facade)/i.test(t)) score += 1;
      if (score > best.score) best = { kind: k.id, score: score };
    });
    // a plan drawn without a title still names its rooms; an untitled sheet
    // whose text is mostly room names is a floor plan, not a detail
    if (best.kind === 'unknown' && ROOMS.test(t)) best = { kind: 'floor', score: 2 };
    if (best.kind === 'floor' && best.score < 4) {
      const roomHits = (t.match(new RegExp(ROOMS.source, 'gi')) || []).length;
      if (roomHits >= 3) best.score = 4 + Math.min(4, roomHits);
    }
    return { kind: best.kind, score: best.score, title: titleOf(t, best.kind), storey: storeyOf(t) };
  }

  async function sheets(file) {
    const doc = await open(file);
    const out = [];
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        let text = '', labels = [], floorTitles = [];
        const vp = page.getViewport({ scale: 1 });
        try {
          const tc = await page.getTextContent();
          text = (tc.items || []).map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
          const rl = roomLabels(tc.items, vp);
          labels = rl.labels; floorTitles = rl.titles;
        } catch (e) { /* a scanned sheet has no text layer */ }
        const c = classify(text);
        out.push({
          page: i, kind: c.kind, title: c.title || (text ? '' : 'No text layer'),
          storey: c.storey, chars: text.length, text: text.slice(0, 6000), labels: labels,
          floorTitles: floorTitles,
          w: Math.round(vp.width), h: Math.round(vp.height),
          longestPt: Math.max(vp.width, vp.height),
          scale: scaleOf(text),
          landscape: vp.width > vp.height
        });
      }
    } finally {
      if (doc.destroy) doc.destroy();
    }
    // the page most likely to be the measured floor plan
    const floors = out.filter(s => s.kind === 'floor').sort((a, b) => (a.storey || 9) - (b.storey || 9));
    const plan = floors.length ? floors[0].page
      : (out.find(s => s.kind === 'site') ? out.find(s => s.kind === 'site').page
      : (out.length === 1 ? 1 : (out.slice().sort((a, b) => b.chars - a.chars)[0] || {}).page || 1));
    return { pages: out, planPage: plan, storeys: out.reduce((m, s) => Math.max(m, s.kind === 'floor' ? (s.storey || 1) : 0), 0) };
  }

  root.PdfImport = {
    sheets,
    classify,
    isPdf,
    /** Render a page of a PDF file. Resolves {dataUrl,width,height,page,pages}. */
    async toImage(file, pageNo, maxDim) {
      const doc = await open(file);
      try {
        return await render(doc, pageNo, maxDim);
      } finally {
        if (doc.destroy) doc.destroy();
      }
    },
    /** Page count without rendering (cheap once the document is open). */
    async pageCount(file) {
      const doc = await open(file);
      const n = doc.numPages;
      if (doc.destroy) doc.destroy();
      return n;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
