/* =====================================================================
   PLAN ANALYSER — reads the line-work of an uploaded plan picture.
   Everything runs locally in a canvas; the image never leaves the device.
   Strategy: grey-scale -> Otsu threshold -> ink mask -> bounding box ->
   row/column ink-density profiles -> long lines = walls -> bay module.
   ===================================================================== */
(function (root) {
  'use strict';

  function toCanvas(img, maxDim) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.round((img.naturalWidth || img.width) * scale);
    const h = Math.round((img.naturalHeight || img.height) * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas: c, ctx, w, h, scale };
  }

  function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = t; }
    }
    return thr;
  }

  function groupRuns(idx) {
    const runs = [];
    let cur = null;
    idx.forEach(i => {
      if (cur && i - cur.end <= 2) { cur.end = i; cur.n++; }
      else { cur = { start: i, end: i, n: 1 }; runs.push(cur); }
    });
    return runs;
  }

  function analyse(img, maxDim) {
    maxDim = maxDim || 1500;
    const { ctx, w, h, scale } = toCanvas(img, maxDim);
    const data = ctx.getImageData(0, 0, w, h).data;

    // ---- grey + histogram
    const grey = new Uint8Array(w * h);
    const hist = new Uint32Array(256);
    let dark = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
      grey[p] = g; hist[g]++;
      if (g < 128) dark++;
    }
    const thr = Math.max(60, Math.min(215, otsu(hist, w * h)));
    const ink = new Uint8Array(w * h);
    for (let p = 0; p < grey.length; p++) ink[p] = grey[p] < thr ? 1 : 0;

    // ---- ink bounding box (ignore thin margins)
    const rowSum = new Uint32Array(h), colSum = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = 0; x < w; x++) s += ink[y * w + x];
      rowSum[y] = s;
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = 0; y < h; y++) s += ink[y * w + x];
      colSum[x] = s;
    }
    const minRow = Math.max(1, Math.round(h * 0.002));
    let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h && rowSum[y0] < minRow) y0++;
    while (y1 > y0 && rowSum[y1] < minRow) y1--;
    while (x0 < w && colSum[x0] < minRow) x0++;
    while (x1 > x0 && colSum[x1] < minRow) x1--;

    const inkBox = { x0, y0, x1, y1, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) };

    // ---- horizontal walls: rows with a long unbroken run of ink
    const hCand = [], vCand = [];
    for (let y = y0; y <= y1; y++) {
      let best = 0, run = 0;
      for (let x = x0; x <= x1; x++) {
        if (ink[y * w + x]) { run++; if (run > best) best = run; } else run = 0;
      }
      if (best > inkBox.w * 0.30) hCand.push({ y, run: best });
    }
    for (let x = x0; x <= x1; x++) {
      let best = 0, run = 0;
      for (let y = y0; y <= y1; y++) {
        if (ink[y * w + x]) { run++; if (run > best) best = run; } else run = 0;
      }
      if (best > inkBox.h * 0.30) vCand.push({ x, run: best });
    }

    const hLines = groupRuns(hCand.map(c => c.y)).map(g => {
      const inRun = hCand.filter(c => c.y >= g.start && c.y <= g.end);
      const best = Math.max.apply(null, inRun.map(c => c.run));
      return { pos: (g.start + g.end) / 2, thickness: g.end - g.start + 1, coverage: best / inkBox.w, kind: 'h' };
    });
    const vLines = groupRuns(vCand.map(c => c.x)).map(g => {
      const inRun = vCand.filter(c => c.x >= g.start && c.x <= g.end);
      const best = Math.max.apply(null, inRun.map(c => c.run));
      return { pos: (g.start + g.end) / 2, thickness: g.end - g.start + 1, coverage: best / inkBox.h, kind: 'v' };
    });

    // strong walls only (span most of the drawing)
    const hStrong = hLines.filter(l => l.coverage > 0.35);
    const vStrong = vLines.filter(l => l.coverage > 0.30);

    /* ---- building envelope ------------------------------------------
       Dimension lines sit outside the building and also run long. The
       building is the NARROWEST pair of strong wall lines that still
       contains ~all the ink on the sheet.                                */
    const colPrefix = new Float64Array(w + 1);
    for (let x = 0; x < w; x++) colPrefix[x + 1] = colPrefix[x] + colSum[x];
    const rowPrefix = new Float64Array(h + 1);
    for (let y = 0; y < h; y++) rowPrefix[y + 1] = rowPrefix[y] + rowSum[y];

    function envelope(lines, prefix, limit, minFrac) {
      const pos = Array.from(new Set(lines.map(l => Math.round(l.pos)))).sort((a, b) => a - b);
      let best = null;
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          const ink = prefix[pos[j] + 1] - prefix[pos[i]];
          if (ink < minFrac * limit) continue;
          const span = pos[j] - pos[i];
          if (!best || span < best.span) best = { a: pos[i], b: pos[j], span };
        }
      }
      return best;
    }
    // walls are drawn thick; dimension lines are hair-lines. Where at least two
    // thick lines exist use them as the building span, else fall back to ink box.
    const thickV = vStrong.filter(l => l.thickness >= 2);
    const thickH = hStrong.filter(l => l.thickness >= 2);
    // a sheet border is drawn right round the page and covers ~100% of it;
    // walls stop at the corners, so coverage separates the two
    const innerV = thickV.filter(l => l.coverage < 0.9);
    const innerH = thickH.filter(l => l.coverage < 0.9);
    const useV = innerV.length >= 2 ? innerV : thickV;
    const useH = innerH.length >= 2 ? innerH : thickH;
    const spanV = useV.length >= 2
      ? { a: Math.min.apply(null, useV.map(l => l.pos)), b: Math.max.apply(null, useV.map(l => l.pos)) }
      : { a: x0, b: x1 };
    const spanH = useH.length >= 2
      ? { a: Math.min.apply(null, useH.map(l => l.pos)), b: Math.max.apply(null, useH.map(l => l.pos)) }
      : { a: y0, b: y1 };
    const bbox = { x0: spanV.a, y0: spanH.a, x1: spanV.b, y1: spanH.b };
    bbox.w = Math.max(1, bbox.x1 - bbox.x0);
    bbox.h = Math.max(1, bbox.y1 - bbox.y0);
    const bw = bbox.w, bh = bbox.h;

    // keep only the wall lines inside the building span
    const insideV = vStrong.filter(l => l.pos >= bbox.x0 - 3 && l.pos <= bbox.x1 + 3);
    const insideH = hStrong.filter(l => l.pos >= bbox.y0 - 3 && l.pos <= bbox.y1 + 3);
    const wallSpanX = bbox.w, wallSpanY = bbox.h;

    // ---- bay module from the vertical walls
    // cluster the gaps between strong vertical lines; the repeated gap is the
    // room module (the office wing produces short, one-off gaps).
    let bays = 0, modulePx = 0;
    const xs = insideV.map(l => l.pos).sort((a, b) => a - b);
    if (xs.length >= 3) {
      const gaps = [];
      for (let i = 1; i < xs.length; i++) {
        const d = xs[i] - xs[i - 1];
        if (d > bw * 0.08) gaps.push(d);
      }
      if (gaps.length) {
        const clusters = [];
        gaps.forEach(g => {
          const hit = clusters.find(c => Math.abs(c.mean - g) / c.mean < 0.07);
          if (hit) { hit.vals.push(g); hit.mean = hit.vals.reduce((a, b) => a + b, 0) / hit.vals.length; }
          else clusters.push({ mean: g, vals: [g] });
        });
        clusters.sort((a, b) => (b.vals.length - a.vals.length) || (b.mean - a.mean));
        modulePx = clusters[0].mean;
        bays = Math.max(1, Math.round(bw / modulePx));
      }
    }

    return {
      width: w, height: h, scale,
      bbox, inkBox,
      threshold: thr, inkRatio: dark / (w * h),
      hLines, vLines, hStrong, vStrong,
      insideV, insideH, wallSpanX, wallSpanY,
      refPx: bbox.w,
      bays, modulePx,
      depthMM: null,
      aspect: bw / bh
    };
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => resolve({ img, dataUrl: fr.result, name: file.name, size: file.size });
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function loadDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  root.PlanAnalyser = { analyse, readFile, loadDataUrl };
})(typeof window !== 'undefined' ? window : globalThis);
